# GitHub Actions: Cross-Platform Binary Builds

This directory contains GitHub Actions workflows for building Discord Lobbies SDK binaries across all supported platforms.

## Available Workflows

### 1. **build-macos-binaries.yml**
Builds macOS binaries for both Intel (x86_64) and Apple Silicon (aarch64).

**Triggers:**
- Manual workflow dispatch
- Push to main/develop branches with changes in `rust-native/` or this workflow file

**Output:** 
- Artifacts: `macos-binaries-x86_64` and `macos-binaries-aarch64`
- These can be downloaded and merged into the codebase

### 2. **build-all-platforms.yml**  
Comprehensive build for all platforms: Linux, macOS, and Windows.

**Triggers:**
- Manual workflow dispatch
- On release publication

**Output:**
- Separate artifacts for each platform
- Platform manifest with integration instructions

## Workflow: macOS Binary Build

### Step-by-step for macOS builds:

1. **Go to GitHub Actions tab** in your repository
2. **Select "Build macOS Binaries"** workflow
3. **Click "Run workflow"** button
4. **Wait for build to complete** (usually 10-15 minutes)
5. **Download artifacts:**
   - `macos-binaries-x86_64` (Intel Macs)
   - `macos-binaries-aarch64` (Apple Silicon M1/M2/M3)

### Integrating macOS binaries into codebase:

```bash
# From the repository root
mkdir -p temp-macos && cd temp-macos

# Download and extract x86_64 artifact
unzip ~/Downloads/macos-binaries-x86_64.zip
cp -r macos-binaries/x86_64/* ../rust-native/target/x86_64-apple-darwin/release/ 2>/dev/null || mkdir -p ../rust-native/target/x86_64-apple-darwin/release && cp -r macos-binaries/x86_64/* ../rust-native/target/x86_64-apple-darwin/release/

# Download and extract aarch64 artifact  
unzip ~/Downloads/macos-binaries-aarch64.zip
cp -r macos-binaries/aarch64/* ../rust-native/target/aarch64-apple-darwin/release/ 2>/dev/null || mkdir -p ../rust-native/target/aarch64-apple-darwin/release && cp -r macos-binaries/aarch64/* ../rust-native/target/aarch64-apple-darwin/release/

cd ..
```

### Building universal VSIX with all platform binaries:

```bash
# After merging all artifacts from all platforms

# Update .vscodeignore to include macOS targets
# (already done in the repo)

# Rebuild the extension
npm run compile
npm run vscode:prepublish

# Package universal VSIX
npx vsce package --no-git-tag-version

# Result: lobbies-sdk-X.X.X.vsix will work on:
# ✅ Linux (x86_64 & ARM64)
# ✅ macOS (Intel & Apple Silicon)
# ✅ Windows (x86_64 & ARM64)
```

## Platform Support Matrix

| Platform | Architecture | Status | Binary Location |
|----------|--------------|--------|-----------------|
| Linux | x86_64 | ✅ Built | `target/release/lobbies-sdk` |
| Linux | ARM64 | ✅ Built | `target/aarch64-unknown-linux-gnu/release/lobbies-sdk` |
| macOS | x86_64 | 🔄 Via GH Actions | `target/x86_64-apple-darwin/release/lobbies-sdk` |
| macOS | ARM64 | 🔄 Via GH Actions | `target/aarch64-apple-darwin/release/lobbies-sdk` |
| Windows | x86_64 | ✅ Built | `target/x86_64-pc-windows-msvc/release/lobbies-sdk.exe` |
| Windows | ARM64 | ✅ Built | `target/aarch64-pc-windows-msvc/release/lobbies-sdk.exe` |

## Required Setup

No additional setup needed! GitHub Actions has:
- ✅ Rust toolchain pre-installed
- ✅ All required targets for cross-compilation
- ✅ Artifact storage and download capability

## Troubleshooting

### Build fails on macOS Actions?

Check:
1. Rust toolchain version compatibility
2. Dependencies in `rust-native/Cargo.toml`
3. SDK availability in runner environment

### Artifacts not appearing?

- Check workflow logs in GitHub Actions tab
- Verify paths in upload-artifact steps
- Ensure binary was compiled successfully

### Binary size seems wrong?

- Debug builds are larger than release
- Use `--release` flag (already included in workflows)
- Verify correct target architecture in paths

## Future Enhancements

- [ ] Auto-merge artifacts into PR
- [ ] Skip step if macOS binaries already exist
- [ ] Create multi-arch universal binary (lipo)
- [ ] Code signing for release builds
- [ ] Notarization for macOS distribution
