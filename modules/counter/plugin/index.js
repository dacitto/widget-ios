const fs = require("node:fs");
const path = require("node:path");

const { createRunOncePlugin, withDangerousMod } = require("expo/config-plugins");

const pkg = require("../../../package.json");

const withCounterWidget = (config, props = {}) => {
  const resolvedProps = {
    appGroup: props.appGroup ?? "group.com.widgetios.counter",
    widgetName: props.widgetName ?? "CounterWidget",
    widgetBundleIdSuffix: props.widgetBundleIdSuffix ?? "CounterWidgetExtension",
  };

  config.extra = config.extra ?? {};
  config.extra.counterWidget = resolvedProps;

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

    const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>com.apple.security.application-groups</key>\n\t<array>\n\t\t<string>${resolvedProps.appGroup}</string>\n\t</array>\n</dict>\n</plist>\n`;
    fs.writeFileSync(destinationEntitlements, entitlementsContent, "utf8");

    return modConfig;
  }]);

  return config;
};

module.exports = createRunOncePlugin(
  withCounterWidget,
  pkg.name,
  pkg.version
);
