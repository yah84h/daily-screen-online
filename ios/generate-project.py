#!/usr/bin/env python3
"""Generate the dependency-free Xcode project. Run after adding Swift files."""
from pathlib import Path
import hashlib
import sys
local = "--local-only" in sys.argv
appName = "SchoolScreenLocal" if local else "SchoolScreen"
root = Path(__file__).resolve().parent

def ident(value):
    return hashlib.sha1(value.encode()).hexdigest()[:24].upper()

def quote(value):
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'

objects = []
def add(key, value):
    objects.append(f'\t\t{ident(key)} = {{ {value} }};')

def refs(keys):
    return '(' + ', '.join(ident(k) for k in keys) + ',)'

sources = sorted(root.glob('SchoolScreen/Core/*.swift')) + sorted(root.glob('SchoolScreen/App/*.swift'))
resources = [root/('SchoolScreen/Resources/LocalDefaults.json' if local else 'SchoolScreen/Resources/Backend.json'), root/'SchoolScreen/Resources/Assets.xcassets'] + [root/('SchoolScreen/Resources/'+name+'.json') for name in ['Palettes','Layouts','DesignDefaults']]
file_keys=[]; source_build=[]; resource_build=[]
for file in sources + resources:
    path = file.relative_to(root).as_posix()
    key = 'file:' + path
    file_keys.append(key)
    kind = 'sourcecode.swift' if file.suffix == '.swift' else 'folder.assetcatalog' if file.suffix == '.xcassets' else 'text.json'
    add(key, f'isa = PBXFileReference; lastKnownFileType = {kind}; path = {quote(path)}; sourceTree = "<group>";')
    build = 'build:' + path
    add(build, f'isa = PBXBuildFile; fileRef = {ident(key)};')
    (source_build if file.suffix == '.swift' else resource_build).append(build)
add('product', f'isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = {appName}.app; sourceTree = BUILT_PRODUCTS_DIR;')
add('products', f'isa = PBXGroup; children = {refs(["product"])}; name = Products; sourceTree = "<group>";')
add('main', f'isa = PBXGroup; children = {refs(file_keys+["products"])}; sourceTree = "<group>";')
add('sources', f'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = {refs(source_build)}; runOnlyForDeploymentPostprocessing = 0;')
add('resources', f'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = {refs(resource_build)}; runOnlyForDeploymentPostprocessing = 0;')
add('frameworks', 'isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
for config in ['Debug','Release']:
    project_settings = 'CLANG_ENABLE_MODULES = YES; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SDKROOT = iphoneos; SWIFT_VERSION = 5.0;'
    if config == 'Debug': project_settings += ' SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG; SWIFT_OPTIMIZATION_LEVEL = "-Onone";'
    else: project_settings += ' SWIFT_OPTIMIZATION_LEVEL = "-O"; VALIDATE_PRODUCT = YES;'
    add('project'+config, f'isa = XCBuildConfiguration; buildSettings = {{ {project_settings} }}; name = {config};')
    settings = {
        'ASSETCATALOG_COMPILER_APPICON_NAME': 'AppIcon',
        'ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME': 'AccentColor',
        'CODE_SIGN_STYLE': 'Automatic',
        'CURRENT_PROJECT_VERSION': '4' if local else '2',
        'GENERATE_INFOPLIST_FILE': 'YES',
        'INFOPLIST_KEY_CFBundleDisplayName': 'الشاشة المحلية' if local else 'الشاشة اليومية',
        'INFOPLIST_KEY_LSApplicationCategoryType': 'public.app-category.education',
        'INFOPLIST_KEY_UIApplicationSceneManifest_Generation': 'YES',
        'INFOPLIST_KEY_UILaunchScreen_Generation': 'YES',
        'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone': 'UIInterfaceOrientationPortrait',
        'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad': 'UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight',
        'MARKETING_VERSION': '0.3.0' if local else '0.1.1',
        'PRODUCT_BUNDLE_IDENTIFIER': 'com.yah84h.schoolpodcast.local' if local else 'com.yah84h.schoolpodcast',
        'PRODUCT_NAME': '$(TARGET_NAME)',
        'SUPPORTED_PLATFORMS': 'iphoneos iphonesimulator',
        'SUPPORTS_MACCATALYST': 'NO',
        'SWIFT_EMIT_LOC_STRINGS': 'YES',
        'SWIFT_STRICT_CONCURRENCY': 'targeted',
        'TARGETED_DEVICE_FAMILY': '1,2'
    }
    if local:
        settings['INFOPLIST_FILE'] = 'SchoolScreen/Resources/Local-Info.plist'
        settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = '$(inherited) LOCAL_ONLY'
    add('app'+config, 'isa = XCBuildConfiguration; buildSettings = { '+' '.join(f'{k} = {quote(v)};' for k,v in settings.items())+f' }}; name = {config};')
add('projectConfigs', f'isa = XCConfigurationList; buildConfigurations = {refs(["projectDebug","projectRelease"])}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
add('appConfigs', f'isa = XCConfigurationList; buildConfigurations = {refs(["appDebug","appRelease"])}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
add('app', f'isa = PBXNativeTarget; buildConfigurationList = {ident("appConfigs")}; buildPhases = {refs(["sources","frameworks","resources"])}; buildRules = (); dependencies = (); name = {appName}; productName = {appName}; productReference = {ident("product")}; productType = "com.apple.product-type.application";')
add('project', f'isa = PBXProject; attributes = {{ BuildIndependentTargetsInParallel = YES; LastSwiftUpdateCheck = 1600; LastUpgradeCheck = 1600; TargetAttributes = {{ {ident("app")} = {{ CreatedOnToolsVersion = 16.0; }}; }}; }}; buildConfigurationList = {ident("projectConfigs")}; compatibilityVersion = "Xcode 14.0"; developmentRegion = ar; hasScannedForEncodings = 0; knownRegions = (ar,en,Base,); mainGroup = {ident("main")}; productRefGroup = {ident("products")}; projectDirPath = ""; projectRoot = ""; targets = {refs(["app"])};')
project = root/(appName+'.xcodeproj')
project.mkdir(exist_ok=True)
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {};\n\tobjectVersion = 56;\n\tobjects = {\n'+'\n'.join(objects)+'\n\t};\n\trootObject = '+ident('project')+';\n}\n')
scheme = project/('xcshareddata/xcschemes/'+appName+'.xcscheme')
scheme.parent.mkdir(parents=True, exist_ok=True)
reference = f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{ident("app")}" BuildableName="{appName}.app" BlueprintName="{appName}" ReferencedContainer="container:{appName}.xcodeproj"/>'
scheme.write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{reference}</BuildActionEntry></BuildActionEntries></BuildAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/>
<ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''')
print(f'Generated project with {len(sources)} Swift files.')
