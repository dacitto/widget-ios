import fs from "node:fs";
import path from "node:path";

import {
  createRunOncePlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withXcodeProject,
  type ConfigPlugin,
  type ExportedConfig,
} from "expo/config-plugins";

type CounterPluginProps = {
  appGroup?: string;
  widgetName?: string;
  widgetBundleIdSuffix?: string;
};

type ResolvedCounterPluginProps = {
  appGroup: string;
  widgetName: string;
  widgetBundleIdSuffix: string;
};

type XcodeProject = any;

const DEFAULT_PROPS: ResolvedCounterPluginProps = {
  appGroup: "group.com.widgetios.counter",
  widgetName: "CounterWidget",
  widgetBundleIdSuffix: "CounterWidgetExtension",
};

const WIDGET_SOURCE_FILES = [
  "AppIntent.swift",
  "CounterIntent.swift",
  "CounterWidget.swift",
  "CounterWidgetBundle.swift",
  "SharedConfig.swift",
];

const WIDGET_INFO_PLIST_TEMPLATE = "CounterWidget-Info.plist";

function resolveProps(props: CounterPluginProps = {}): ResolvedCounterPluginProps {
  const resolvedProps: ResolvedCounterPluginProps = {
    appGroup: props.appGroup ?? DEFAULT_PROPS.appGroup,
    widgetName: props.widgetName ?? DEFAULT_PROPS.widgetName,
    widgetBundleIdSuffix:
      props.widgetBundleIdSuffix ?? DEFAULT_PROPS.widgetBundleIdSuffix,
  };

  validateProps(resolvedProps);

  return resolvedProps;
}

function normalizeBundleIdSuffix(value: string): string {
  return value.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
}

function validateProps(props: ResolvedCounterPluginProps): void {
  const appGroupPattern = /^group\.[A-Za-z0-9.-]+$/;
  if (!appGroupPattern.test(props.appGroup)) {
    throw new Error(
      `[counter plugin] Invalid appGroup "${props.appGroup}". Expected format like "group.com.example.app".`
    );
  }

  const xcodeNamePattern = /^[A-Za-z][A-Za-z0-9_]*$/;
  if (!xcodeNamePattern.test(props.widgetName)) {
    throw new Error(
      `[counter plugin] Invalid widgetName "${props.widgetName}". Use letters, numbers, and underscores, starting with a letter.`
    );
  }

  const suffixPattern = /^[A-Za-z0-9._-]+$/;
  if (!suffixPattern.test(props.widgetBundleIdSuffix)) {
    throw new Error(
      `[counter plugin] Invalid widgetBundleIdSuffix "${props.widgetBundleIdSuffix}". Use letters, numbers, dot, underscore, or hyphen.`
    );
  }

  const normalizedSuffix = normalizeBundleIdSuffix(props.widgetBundleIdSuffix);
  if (!normalizedSuffix) {
    throw new Error(
      `[counter plugin] widgetBundleIdSuffix "${props.widgetBundleIdSuffix}" normalizes to an empty value.`
    );
  }
}

function getWidgetPaths(
  projectRoot: string,
  iosRoot: string,
  resolvedProps: ResolvedCounterPluginProps
) {
  const sourceRoot = path.join(projectRoot, "modules", "counter", "ios-widget");
  const sourceWidgetRoot = path.join(sourceRoot, "CounterWidget");
  const sourceTemplatesRoot = path.join(sourceRoot, "templates");

  const destinationWidgetRoot = path.join(iosRoot, resolvedProps.widgetName);
  const destinationEntitlements = path.join(
    iosRoot,
    `${resolvedProps.widgetBundleIdSuffix}.entitlements`
  );

  const infoPlistTemplatePath = path.join(
    sourceTemplatesRoot,
    WIDGET_INFO_PLIST_TEMPLATE
  );
  const infoPlistDestinationPath = path.join(destinationWidgetRoot, "Info.plist");

  return {
    sourceWidgetRoot,
    destinationWidgetRoot,
    destinationEntitlements,
    infoPlistTemplatePath,
    infoPlistDestinationPath,
  };
}

function getBuildPhaseUuidByTargetUuid(
  project: XcodeProject,
  targetUuid: string,
  phaseIsa: string
): string | null {
  const nativeTarget = project.pbxNativeTargetSection()[targetUuid];
  if (!nativeTarget || !Array.isArray(nativeTarget.buildPhases)) {
    return null;
  }

  const phases = project.hash.project.objects[phaseIsa] || {};
  for (const phaseRef of nativeTarget.buildPhases) {
    const phase = phases[phaseRef.value];
    if (phase) {
      return phaseRef.value;
    }
  }
  return null;
}

function ensureWidgetSourcesMembership(
  project: XcodeProject,
  widgetFiles: string[],
  widgetName: string,
  widgetTargetUuid: string
): void {
  const objects = project.hash.project.objects;
  const fileRefs = project.pbxFileReferenceSection();
  const buildFiles = project.pbxBuildFileSection();
  const sourcesPhases = objects.PBXSourcesBuildPhase || {};

  const mainTarget = project.getFirstTarget();
  const mainTargetUuid = mainTarget?.uuid;
  const mainSourcesUuid = mainTargetUuid
    ? getBuildPhaseUuidByTargetUuid(project, mainTargetUuid, "PBXSourcesBuildPhase")
    : null;
  const widgetSourcesUuid = getBuildPhaseUuidByTargetUuid(
    project,
    widgetTargetUuid,
    "PBXSourcesBuildPhase"
  );

  if (!widgetSourcesUuid) return;

  const sourceMap = new Map(widgetFiles.map((name) => [name, `${widgetName}/${name}`]));

  const fileRefByName = new Map<string, string>();
  Object.entries(fileRefs).forEach(([uuid, ref]) => {
    if (!ref || typeof ref !== "object") return;
    const refPath = String((ref as { path?: string }).path || "").replace(/"/g, "");
    const refName = String((ref as { name?: string }).name || "").replace(/"/g, "");

    for (const [fileName, groupPath] of sourceMap.entries()) {
      if (refPath === fileName || refPath === groupPath || refName === fileName) {
        fileRefByName.set(fileName, uuid);
      }
    }
  });

  const widgetSourcePhase = sourcesPhases[widgetSourcesUuid];
  if (!widgetSourcePhase.files) widgetSourcePhase.files = [];

  for (const [fileName, fileRefUuid] of fileRefByName.entries()) {
    let buildFileUuid: string | null = null;
    Object.entries(buildFiles).forEach(([uuid, buildFile]) => {
      if (!buildFile || typeof buildFile !== "object") return;
      if ((buildFile as { fileRef?: string }).fileRef === fileRefUuid) {
        buildFileUuid = uuid;
      }
    });

    const ensuredBuildFileUuid = buildFileUuid ?? project.generateUuid();

    if (!buildFileUuid) {
      buildFiles[ensuredBuildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: fileRefUuid,
      };
      buildFiles[`${ensuredBuildFileUuid}_comment`] = `${fileName} in Sources`;
    }

    const alreadyInWidgetSources = widgetSourcePhase.files.some(
      (entry: { value: string }) => entry.value === ensuredBuildFileUuid
    );
    if (!alreadyInWidgetSources) {
      widgetSourcePhase.files.push({
        value: ensuredBuildFileUuid,
        comment: `${fileName} in Sources`,
      });
    }

    if (mainSourcesUuid && sourcesPhases[mainSourcesUuid]?.files) {
      sourcesPhases[mainSourcesUuid].files = sourcesPhases[mainSourcesUuid].files.filter(
        (entry: { value: string }) => entry.value !== ensuredBuildFileUuid
      );
    }
  }
}

function ensureTargetBuildPhases(project: XcodeProject, targetUuid: string): void {
  const nativeTarget = project.pbxNativeTargetSection()[targetUuid];
  if (!nativeTarget) return;

  const hasSources = Boolean(getBuildPhaseUuidByTargetUuid(project, targetUuid, "PBXSourcesBuildPhase"));
  const hasFrameworks = Boolean(getBuildPhaseUuidByTargetUuid(project, targetUuid, "PBXFrameworksBuildPhase"));
  const hasResources = Boolean(getBuildPhaseUuidByTargetUuid(project, targetUuid, "PBXResourcesBuildPhase"));

  if (!hasSources) {
    project.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", targetUuid);
  }
  if (!hasFrameworks) {
    project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", targetUuid);
  }
  if (!hasResources) {
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", targetUuid);
  }
}

function getBuildConfigurationsForTarget(
  project: XcodeProject,
  targetUuid: string
): Array<{ buildSettings?: Record<string, string> }> {
  const nativeTarget = project.pbxNativeTargetSection()[targetUuid];
  const buildConfigListUuid = nativeTarget?.buildConfigurationList;
  if (!buildConfigListUuid) {
    return [];
  }

  const buildConfigLists = project.pbxXCConfigurationList();
  const listEntry = buildConfigLists[buildConfigListUuid];
  const configRefs = listEntry?.buildConfigurations;
  if (!Array.isArray(configRefs)) {
    return [];
  }

  const allBuildConfigurations = project.pbxXCBuildConfigurationSection();
  return configRefs
    .map((entry: { value?: string }) => {
      const configUuid = entry?.value;
      if (!configUuid) return null;
      const config = allBuildConfigurations[configUuid];
      if (!config || typeof config !== "object") return null;
      return config;
    })
    .filter(Boolean);
}

function getHostVersionSettings(project: XcodeProject): {
  marketingVersion?: string;
  currentProjectVersion?: string;
} {
  const mainTarget = project.getFirstTarget();
  const mainTargetUuid = mainTarget?.uuid;
  if (!mainTargetUuid) {
    return {};
  }

  const hostBuildConfigurations = getBuildConfigurationsForTarget(project, mainTargetUuid);
  for (const buildConfig of hostBuildConfigurations) {
    const buildSettings = buildConfig.buildSettings;
    if (!buildSettings) continue;

    const marketingVersion = buildSettings.MARKETING_VERSION;
    const currentProjectVersion = buildSettings.CURRENT_PROJECT_VERSION;

    if (marketingVersion || currentProjectVersion) {
      return { marketingVersion, currentProjectVersion };
    }
  }

  return {};
}

const withCounterWidget: ConfigPlugin<CounterPluginProps> = (config, props = {}) => {
  const appBundleIdentifier = config.ios?.bundleIdentifier;
  const resolvedProps = resolveProps(props);

  config.extra = config.extra ?? {};
  config.extra.counterWidget = resolvedProps;

  config = withEntitlementsPlist(config, (modConfig) => {
    const key = "com.apple.security.application-groups";
    const currentGroups = Array.isArray(modConfig.modResults[key])
      ? modConfig.modResults[key]
      : [];

    if (!currentGroups.includes(resolvedProps.appGroup)) {
      modConfig.modResults[key] = [...currentGroups, resolvedProps.appGroup];
    }

    return modConfig;
  });

  config = withDangerousMod(config, ["ios", async (modConfig) => {
    const projectRoot = modConfig.modRequest.projectRoot;
    const iosRoot = modConfig.modRequest.platformProjectRoot;

    const {
      sourceWidgetRoot,
      destinationWidgetRoot,
      destinationEntitlements,
      infoPlistTemplatePath,
      infoPlistDestinationPath,
    } = getWidgetPaths(projectRoot, iosRoot, resolvedProps);

    fs.mkdirSync(destinationWidgetRoot, { recursive: true });
    fs.cpSync(sourceWidgetRoot, destinationWidgetRoot, { recursive: true, force: true });

    fs.copyFileSync(infoPlistTemplatePath, infoPlistDestinationPath);

    const sharedConfigPath = path.join(destinationWidgetRoot, "SharedConfig.swift");
    const sharedConfigContents = `import Foundation\n\nenum SharedConfig {\n    static let appGroupIdentifier = "${resolvedProps.appGroup}"\n    static let countFileName = "count.txt"\n    static let showResetButtonKey = "counterWidget.showResetButton"\n}\n`;
    fs.writeFileSync(sharedConfigPath, sharedConfigContents, "utf8");

    const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>com.apple.security.application-groups</key>\n\t<array>\n\t\t<string>${resolvedProps.appGroup}</string>\n\t</array>\n</dict>\n</plist>\n`;
    fs.writeFileSync(destinationEntitlements, entitlementsContent, "utf8");

    return modConfig;
  }]);

  config = withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const widgetName = resolvedProps.widgetName;
    const widgetTargetName = resolvedProps.widgetBundleIdSuffix;

    let target = project.pbxTargetByName(widgetTargetName);
    if (!target) {
      target = project.addTarget(widgetTargetName, "app_extension", widgetName, widgetName);
    }

    const widgetTargetUuid = target.uuid;
    ensureTargetBuildPhases(project, widgetTargetUuid);

    const groupKey = project.findPBXGroupKey({ name: widgetName });
    let groupUuid = groupKey;
    if (!groupUuid) {
      const group = project.addPbxGroup([], widgetName, widgetName);
      groupUuid = group.uuid;
      const rootGroupKey = project.getFirstProject().firstProject.mainGroup;
      project.addToPbxGroup(groupUuid, rootGroupKey);
    }

    const fileReferences = project.pbxFileReferenceSection();
    WIDGET_SOURCE_FILES.forEach((fileName) => {
      const relativePath = `${widgetName}/${fileName}`;
      const hasReference = Object.values(fileReferences).some(
        (ref: any) =>
          ref &&
          (ref.path === `"${fileName}"` ||
            ref.path === fileName ||
            ref.path === `"${relativePath}"` ||
            ref.path === relativePath)
      );
      if (!hasReference) {
        project.addSourceFile(fileName, { target: widgetTargetUuid }, groupUuid);
      }
    });

    ensureWidgetSourcesMembership(
      project,
      WIDGET_SOURCE_FILES,
      widgetName,
      widgetTargetUuid
    );

    const infoPlistPath = `${widgetName}/Info.plist`;
    const normalizedSuffix = normalizeBundleIdSuffix(resolvedProps.widgetBundleIdSuffix);
    const productBundleIdentifier = appBundleIdentifier
      ? `${appBundleIdentifier}.${normalizedSuffix}`
      : `$(PRODUCT_BUNDLE_IDENTIFIER).${normalizedSuffix}`;
    const hostVersionSettings = getHostVersionSettings(project);
    const buildConfigurations = getBuildConfigurationsForTarget(project, widgetTargetUuid);
    buildConfigurations.forEach((buildConfig) => {
      buildConfig.buildSettings = buildConfig.buildSettings || {};
      buildConfig.buildSettings.INFOPLIST_FILE = infoPlistPath;
      buildConfig.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = productBundleIdentifier;
      buildConfig.buildSettings.CODE_SIGN_ENTITLEMENTS = `${widgetTargetName}.entitlements`;
      buildConfig.buildSettings.SKIP_INSTALL = "YES";
      buildConfig.buildSettings.SWIFT_VERSION = "5.0";
      buildConfig.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = "17.0";
      buildConfig.buildSettings.APPLICATION_EXTENSION_API_ONLY = "YES";

      if (
        !buildConfig.buildSettings.MARKETING_VERSION &&
        hostVersionSettings.marketingVersion
      ) {
        buildConfig.buildSettings.MARKETING_VERSION = hostVersionSettings.marketingVersion;
      }
      if (
        !buildConfig.buildSettings.CURRENT_PROJECT_VERSION &&
        hostVersionSettings.currentProjectVersion
      ) {
        buildConfig.buildSettings.CURRENT_PROJECT_VERSION =
          hostVersionSettings.currentProjectVersion;
      }
    });

    return modConfig;
  });

  return config;
};

const pluginVersion = "1.0.0";
const pluginName = "counter";

const plugin: ConfigPlugin<CounterPluginProps> = createRunOncePlugin(
  withCounterWidget,
  pluginName,
  pluginVersion
);

export default plugin;
module.exports = plugin;
