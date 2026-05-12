const { createRunOncePlugin } = require("expo/config-plugins");

const pkg = require("../../../package.json");

const withCounterWidget = (config, props = {}) => {
  const resolvedProps = {
    appGroup: props.appGroup ?? "group.com.widgetios.counter",
    widgetName: props.widgetName ?? "CounterWidget",
    widgetBundleIdSuffix: props.widgetBundleIdSuffix ?? "CounterWidgetExtension",
  };

  config.extra = config.extra ?? {};
  config.extra.counterWidget = resolvedProps;

  return config;
};

module.exports = createRunOncePlugin(
  withCounterWidget,
  pkg.name,
  pkg.version
);
