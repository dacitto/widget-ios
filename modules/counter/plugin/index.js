const fs = require("node:fs");
const path = require("node:path");

const {
  createRunOncePlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withXcodeProject,
} = require("expo/config-plugins");

const pkg = require("../../../package.json");

const DEFAULT_PROPS = {
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

function resolveProps(props = {}) {
  return {
    appGroup: props.appGroup ?? DEFAULT_PROPS.appGroup,
    widgetName: props.widgetName ?? DEFAULT_PROPS.widgetName,
    widgetBundleIdSuffix:
      props.widgetBundleIdSuffix ?? DEFAULT_PROPS.widgetBundleIdSuffix,
  };
}

function normalizeBundleIdSuffix(value) {
  return value.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
}

function getBuildPhaseUuidByTargetUuid(project, targetUuid, phaseIsa) {
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

function ensureWidgetSourcesMembership(project, widgetFiles, widgetName, widgetTargetUuid) {
  const objects = project.hash.project.objects;
  const fileRefs = project.pbxFileReferenceSection();
  const buildFiles = project.pbxBuildFileSection();
  const sourcesPhases = objects.PBXSourcesBuildPhase || {};
  const nativeTargets = project.pbxNativeTargetSection();

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

  const sourceMap = new Map(
    widgetFiles.map((name) => [name, `${widgetName}/${name}`])
  );

  const fileRefByName = new Map();
  Object.entries(fileRefs).forEach(([uuid, ref]) => {
    if (!ref || typeof ref !== "object") return;
    const refPath = String(ref.path || "").replaceAll('"', "");
    const refName = String(ref.name || "").replaceAll('"', "");

    for (const [fileName, groupPath] of sourceMap.entries()) {
      if (
        refPath === fileName ||
        refPath === groupPath ||
        refName === fileName
      ) {
        fileRefByName.set(fileName, uuid);
      }
    }
  });

  const widgetSourcePhase = sourcesPhases[widgetSourcesUuid];
  if (!widgetSourcePhase.files) widgetSourcePhase.files = [];

  for (const [fileName, fileRefUuid] of fileRefByName.entries()) {
    let buildFileUuid = null;
    Object.entries(buildFiles).forEach(([uuid, buildFile]) => {
      if (!buildFile || typeof buildFile !== "object") return;
      if (buildFile.fileRef === fileRefUuid) {
        buildFileUuid = uuid;
      }
    });

    if (!buildFileUuid) {
      buildFileUuid = project.generateUuid();
      buildFiles[buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: fileRefUuid,
      };
      buildFiles[`${buildFileUuid}_comment`] = `${fileName} in Sources`;
    }

    const alreadyInWidgetSources = widgetSourcePhase.files.some(
      (entry) => entry.value === buildFileUuid
    );
    if (!alreadyInWidgetSources) {
      widgetSourcePhase.files.push({
        value: buildFileUuid,
        comment: `${fileName} in Sources`,
      });
    }

    if (mainSourcesUuid && sourcesPhases[mainSourcesUuid]?.files) {
      sourcesPhases[mainSourcesUuid].files = sourcesPhases[mainSourcesUuid].files.filter(
        (entry) => entry.value !== buildFileUuid
      );
    }
  }
}

function ensureTargetBuildPhases(project, targetUuid) {
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

const withCounterWidget = (config, props = {}) => {
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

    const sourceRoot = path.join(projectRoot, "modules", "counter", "ios-widget");
    const sourceWidgetRoot = path.join(sourceRoot, "CounterWidget");
    const sourceTemplatesRoot = path.join(sourceRoot, "templates");

    const destinationWidgetRoot = path.join(iosRoot, resolvedProps.widgetName);
    const destinationEntitlements = path.join(
      iosRoot,
      `${resolvedProps.widgetBundleIdSuffix}.entitlements`
    );

    fs.mkdirSync(destinationWidgetRoot, { recursive: true });
    fs.cpSync(sourceWidgetRoot, destinationWidgetRoot, { recursive: true, force: true });

    const infoPlistTemplatePath = path.join(
      sourceTemplatesRoot,
      "CounterWidget-Info.plist"
    );
    fs.copyFileSync(infoPlistTemplatePath, path.join(destinationWidgetRoot, "Info.plist"));

    const sharedConfigPath = path.join(destinationWidgetRoot, "SharedConfig.swift");
    const sharedConfigContents = `import Foundation\n\nenum SharedConfig {\n    static let appGroupIdentifier = "${resolvedProps.appGroup}"\n    static let countFileName = "count.txt"\n}\n`;
    fs.writeFileSync(sharedConfigPath, sharedConfigContents, "utf8");

    const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>com.apple.security.application-groups</key>\n\t<array>\n\t\t<string>${resolvedProps.appGroup}</string>\n\t</array>\n</dict>\n</plist>\n`;
    fs.writeFileSync(destinationEntitlements, entitlementsContent, "utf8");

    return modConfig;
  }]);

  config = withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const projectRoot = modConfig.modRequest.projectRoot;
    const iosRoot = modConfig.modRequest.platformProjectRoot;
    const widgetName = resolvedProps.widgetName;
    const widgetTargetName = resolvedProps.widgetBundleIdSuffix;

    let target = project.pbxTargetByName(widgetTargetName);
    if (!target) {
      target = project.addTarget(widgetTargetName, "app_extension", widgetName, widgetName);
    }

    const widgetTargetUuid = target.uuid;
    ensureTargetBuildPhases(project, widgetTargetUuid);

    const widgetFiles = WIDGET_SOURCE_FILES;

    const groupKey = project.findPBXGroupKey({ name: widgetName });
    let groupUuid = groupKey;
    if (!groupUuid) {
      const group = project.addPbxGroup([], widgetName, widgetName);
      groupUuid = group.uuid;
      const rootGroupKey = project.getFirstProject().firstProject.mainGroup;
      project.addToPbxGroup(groupUuid, rootGroupKey);
    }

    const fileReferences = project.pbxFileReferenceSection();
    widgetFiles.forEach((fileName) => {
      const relativePath = `${widgetName}/${fileName}`;
      const hasReference = Object.values(fileReferences).some(
        (ref) => ref && (ref.path === `"${fileName}"` || ref.path === fileName || ref.path === `"${relativePath}"` || ref.path === relativePath)
      );
      if (!hasReference) {
        project.addSourceFile(fileName, { target: widgetTargetUuid }, groupUuid);
      }
    });

    ensureWidgetSourcesMembership(project, widgetFiles, widgetName, widgetTargetUuid);

    const infoPlistPath = `${widgetName}/Info.plist`;
    const normalizedSuffix = normalizeBundleIdSuffix(resolvedProps.widgetBundleIdSuffix);
    const productBundleIdentifier = appBundleIdentifier
      ? `${appBundleIdentifier}.${normalizedSuffix}`
      : `$(PRODUCT_BUNDLE_IDENTIFIER).${normalizedSuffix}`;
    const buildConfigurations = project.pbxXCBuildConfigurationSection();

    Object.keys(buildConfigurations).forEach((key) => {
      const buildConfig = buildConfigurations[key];
      if (!buildConfig || typeof buildConfig !== "object") return;
      if (!buildConfig.buildSettings) return;

      const productName = String(buildConfig.buildSettings.PRODUCT_NAME || "").replaceAll('"', "");
      const infoPlist = String(buildConfig.buildSettings.INFOPLIST_FILE || "").replaceAll('"', "");
      const entitlements = String(buildConfig.buildSettings.CODE_SIGN_ENTITLEMENTS || "").replaceAll('"', "");
      const isWidgetConfig =
        productName === widgetTargetName ||
        infoPlist === infoPlistPath ||
        entitlements === `${widgetTargetName}.entitlements`;
      if (!isWidgetConfig) return;

      buildConfig.buildSettings.INFOPLIST_FILE = infoPlistPath;
      buildConfig.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = productBundleIdentifier;
      buildConfig.buildSettings.CODE_SIGN_ENTITLEMENTS = `${widgetTargetName}.entitlements`;
      buildConfig.buildSettings.SKIP_INSTALL = "YES";
      buildConfig.buildSettings.SWIFT_VERSION = "5.0";
      buildConfig.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = "17.0";
      buildConfig.buildSettings.APPLICATION_EXTENSION_API_ONLY = "YES";
      buildConfig.buildSettings.CURRENT_PROJECT_VERSION = "1";
      buildConfig.buildSettings.MARKETING_VERSION = "1.0.0";
    });

    const infoPlistTemplatePath = path.join(
      projectRoot,
      "modules",
      "counter",
      "ios-widget",
      "templates",
      "CounterWidget-Info.plist"
    );
    const infoPlistDestinationPath = path.join(iosRoot, widgetName, "Info.plist");
    fs.copyFileSync(infoPlistTemplatePath, infoPlistDestinationPath);

    return modConfig;
  });

  return config;
};

module.exports = createRunOncePlugin(
  withCounterWidget,
  pkg.name,
  pkg.version
);
