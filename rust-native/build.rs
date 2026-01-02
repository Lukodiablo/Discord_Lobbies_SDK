use std::path::PathBuf;
use std::env;
use std::fs;

fn find_discord_sdk_lib_path(parent_dir: &std::path::Path) -> Option<PathBuf> {
    // Priority 1: Environment variable
    if let Ok(env_path) = std::env::var("DISCORD_SDK_PATH") {
        let path = PathBuf::from(&env_path);
        if is_valid_sdk(&path) {
            return Some(path.join("lib/release"));
        }
        // Check if it contains discord_social_sdk subdir
        let sdk_dir = path.join("discord_social_sdk");
        if is_valid_sdk(&sdk_dir) {
            return Some(sdk_dir.join("lib/release"));
        }
    }
    
    // Priority 2: Project root directory
    if let Some(sdk_path) = find_sdk_in_directory(parent_dir) {
        return Some(sdk_path);
    }
    
    // Priority 3: Common system locations
    let system_locations = if cfg!(target_os = "linux") {
        vec![
            PathBuf::from("/opt/discord-sdk"),
            PathBuf::from("/usr/local/discord-sdk"),
            PathBuf::from(format!("{}/.discord-sdk", std::env::var("HOME").unwrap_or_default())),
        ]
    } else if cfg!(target_os = "windows") {
        vec![
            PathBuf::from("C:\\Discord SDK"),
            PathBuf::from("C:\\Program Files\\Discord SDK"),
        ]
    } else {
        vec![
            PathBuf::from("/opt/discord-sdk"),
            PathBuf::from(format!("{}/.discord-sdk", std::env::var("HOME").unwrap_or_default())),
        ]
    };
    
    for location in system_locations {
        if location.exists() {
            if let Some(sdk_path) = find_sdk_in_directory(&location) {
                return Some(sdk_path);
            }
        }
    }
    
    None
}

fn find_sdk_in_directory(search_dir: &std::path::Path) -> Option<PathBuf> {
    let mut sdk_paths: Vec<(String, PathBuf)> = Vec::new();
    
    if let Ok(entries) = fs::read_dir(search_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    let name = entry.file_name();
                    let name_str = name.to_string_lossy();
                    
                    // Check for DiscordSocialSdk-* pattern (versioned)
                    if name_str.starts_with("DiscordSocialSdk-") {
                        if let Some(version) = name_str.strip_prefix("DiscordSocialSdk-") {
                            let lib_path = entry.path().join("discord_social_sdk/lib/release");
                            if lib_path.exists() {
                                sdk_paths.push((version.to_string(), lib_path));
                            }
                        }
                    }
                    // Check for plain discord_social_sdk folder (unversioned, from zip extraction)
                    else if name_str == "discord_social_sdk" {
                        let lib_path = entry.path().join("lib/release");
                        if lib_path.exists() {
                            sdk_paths.push(("999.999.999".to_string(), lib_path));
                        }
                    }
                }
            }
        }
    }
    
    if !sdk_paths.is_empty() {
        sdk_paths.sort_by(|a, b| b.0.cmp(&a.0));
        return Some(sdk_paths[0].1.clone());
    }
    
    None
}

fn is_valid_sdk(path: &std::path::Path) -> bool {
    path.exists() && 
    path.join("include").exists() && 
    path.join("lib").exists()
}

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let parent_dir = PathBuf::from(&manifest_dir).parent().unwrap().to_path_buf();
    
    // Find the Discord SDK lib path (returns the actual lib/release path)
    let sdk_path = find_discord_sdk_lib_path(&parent_dir).unwrap_or_else(|| {
        eprintln!("Discord Social SDK not found in {}", parent_dir.display());
        eprintln!("Expected: DiscordSocialSdk-*/discord_social_sdk/lib/release or discord_social_sdk/lib/release");
        std::process::exit(1);
    });

    // Platform-specific SDK linking
    #[cfg(target_os = "linux")]
    {
        if !sdk_path.exists() {
            panic!(
                "Discord Social SDK lib/release not found at: {:?}",
                sdk_path
            );
        }

        // Link against the Discord Social SDK library
        println!("cargo:rustc-link-search=native={}", sdk_path.display());
        println!("cargo:rustc-link-lib=dylib=discord_partner_sdk");
        println!("cargo:rustc-link-lib=dylib=stdc++");
        println!("cargo:warning=Using Discord SDK from: {}", sdk_path.display());
    }

    #[cfg(target_os = "windows")]
    {
        if !sdk_path.exists() {
            panic!(
                "Discord Social SDK lib/release not found at: {:?}",
                sdk_path
            );
        }

        // Link against the Discord Social SDK library on Windows
        println!("cargo:rustc-link-search=native={}", sdk_path.display());
        println!("cargo:rustc-link-lib=dylib=discord_partner_sdk");
        println!("cargo:warning=Using Discord SDK from: {}", sdk_path.display());
    }

    #[cfg(target_os = "macos")]
    {
        if !sdk_path.exists() {
            panic!(
                "Discord Social SDK lib/release not found at: {:?}",
                sdk_path
            );
        }

        println!("cargo:rustc-link-search=native={}", sdk_path.display());
        println!("cargo:rustc-link-lib=dylib=discord_partner_sdk");
        println!("cargo:rustc-link-lib=dylib=stdc++");
        println!("cargo:warning=Using Discord SDK from: {}", sdk_path.display());
    }
}
