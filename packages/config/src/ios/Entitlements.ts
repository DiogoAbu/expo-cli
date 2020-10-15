import fs from 'fs-extra';
import path from 'path';

import { ConfigPlugin, ExpoConfig } from '../Config.types';
import { addWarningIOS } from '../WarningAggregator';
import { withEntitlementsPlist } from '../plugins/ios-plugins';
import { InfoPlist } from './IosConfig.types';
import * as Paths from './Paths';
import {
  getPbxproj,
  getProjectName,
  isBuildConfig,
  isNotComment,
  isNotTestHost,
} from './utils/Xcodeproj';

type Plist = Record<string, any>;

export const withAccessesContactNotes: ConfigPlugin = config => {
  return withEntitlementsPlist(config, config => {
    config.props.data = setAccessesContactNotes(config.expo, config.props.data);
    return config;
  });
};

export const withAssociatedDomains: ConfigPlugin = config => {
  return withEntitlementsPlist(config, config => {
    config.props.data = setAssociatedDomains(config.expo, config.props.data);
    return config;
  });
};

export const withICloudEntitlement: ConfigPlugin<{ appleTeamId: string }> = (
  config,
  { appleTeamId }
) => {
  return withEntitlementsPlist(config, config => {
    config.props.data = setICloudEntitlement(config.expo, config.props.data, appleTeamId);
    return config;
  });
};

export const withAppleSignInEntitlement: ConfigPlugin = config => {
  return withEntitlementsPlist(config, config => {
    config.props.data = setAppleSignInEntitlement(config.expo, config.props.data);
    return config;
  });
};

// TODO: should it be possible to turn off these entitlements by setting false in app.json and running apply

export function getConfigEntitlements(config: ExpoConfig) {
  return config.ios?.entitlements ?? {};
}

export function setCustomEntitlementsEntries(config: ExpoConfig, entitlements: InfoPlist) {
  const entries = getConfigEntitlements(config);

  return {
    ...entitlements,
    ...entries,
  };
}

export function setICloudEntitlement(
  config: ExpoConfig,
  entitlementsPlist: Plist,
  appleTeamId: string
): Plist {
  if (config.ios?.usesIcloudStorage) {
    // TODO: need access to the appleTeamId for this one!
    addWarningIOS(
      'ios.usesIcloudStorage',
      'Enable the iCloud Storage Entitlement from the Capabilities tab in your Xcode project.'
      // TODO: add a link to a docs page with more information on how to do this
    );
  }

  return entitlementsPlist;
}

export function setAppleSignInEntitlement(
  config: ExpoConfig,
  { 'com.apple.developer.applesignin': _, ...entitlementsPlist }: Plist
): Plist {
  if (config.ios?.usesAppleSignIn) {
    return {
      ...entitlementsPlist,
      'com.apple.developer.applesignin': ['Default'],
    };
  }

  return entitlementsPlist;
}

export function setAccessesContactNotes(
  config: ExpoConfig,
  { 'com.apple.developer.contacts.notes': _, ...entitlementsPlist }: Plist
): Plist {
  if (config.ios?.accessesContactNotes) {
    return {
      ...entitlementsPlist,
      'com.apple.developer.contacts.notes': config.ios.accessesContactNotes,
    };
  }

  return entitlementsPlist;
}

export function setAssociatedDomains(
  config: ExpoConfig,
  { 'com.apple.developer.associated-domains': _, ...entitlementsPlist }: Plist
): Plist {
  if (config.ios?.associatedDomains) {
    return {
      ...entitlementsPlist,
      'com.apple.developer.associated-domains': config.ios.associatedDomains,
    };
  }

  return entitlementsPlist;
}

export function getEntitlementsPath(projectRoot: string): string {
  return Paths.getEntitlementsPath(projectRoot) ?? createEntitlementsFile(projectRoot);
}

function createEntitlementsFile(projectRoot: string) {
  /**
   * Write file from template
   */
  const entitlementsPath = getDefaultEntitlementsPath(projectRoot);
  if (!fs.pathExistsSync(path.dirname(entitlementsPath))) {
    fs.mkdirSync(path.dirname(entitlementsPath));
  }
  fs.writeFileSync(entitlementsPath, ENTITLEMENTS_TEMPLATE);
  const entitlementsRelativePath = entitlementsPath.replace(`${projectRoot}/ios/`, '');

  /**
   * Add file to pbxproj under CODE_SIGN_ENTITLEMENTS
   */
  const project = getPbxproj(projectRoot);
  Object.entries(project.pbxXCBuildConfigurationSection())
    .filter(isNotComment)
    .filter(isBuildConfig)
    .filter(isNotTestHost)
    .forEach(({ 1: { buildSettings } }: any) => {
      buildSettings.CODE_SIGN_ENTITLEMENTS = entitlementsRelativePath;
    });
  fs.writeFileSync(project.filepath, project.writeSync());

  return entitlementsPath;
}

function getDefaultEntitlementsPath(projectRoot: string) {
  const projectName = getProjectName(projectRoot);
  const project = getPbxproj(projectRoot);
  const productName = project.productName;
  return path.join(projectRoot, 'ios', projectName, `${productName}.entitlements`);
}

const ENTITLEMENTS_TEMPLATE = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
</dict>
</plist>
`;
