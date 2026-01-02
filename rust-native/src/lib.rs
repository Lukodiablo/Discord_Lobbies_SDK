//! Discord Social SDK Rust Bindings
//! FFI bindings to the Discord Social SDK C++ library
//! - On Linux: Links against Discord Social SDK for full functionality
//! - On Windows/macOS: Builds as a library, SDK integration handled by TypeScript layer

use libc::{c_char, c_int, c_void};
use std::ffi::{CStr, CString};
use std::ptr;
use std::sync::Arc;
use parking_lot::Mutex;

// ===== FFI Type Definitions =====

/// Discord Client Handle (opaque pointer)
#[repr(C)]
pub struct DiscordClient {
    _private: [u8; 0],
}

/// Discord Activity for Rich Presence
#[repr(C)]
pub struct DiscordActivity {
    pub state: [c_char; 128],
    pub details: [c_char; 128],
    pub assets_large_image: [c_char; 256],
    pub assets_large_text: [c_char; 128],
    pub party_id: [c_char; 128],
}

/// Discord User
#[repr(C)]
pub struct DiscordUser {
    pub id: u64,
    pub username: [c_char; 256],
    pub discriminator: [c_char; 10],
    pub avatar: [c_char; 256],
}

/// Discord Channel
#[repr(C)]
pub struct DiscordChannel {
    pub id: u64,
    pub guild_id: u64,
    pub name: [c_char; 100],
    pub topic: [c_char; 1024],
    pub is_private: c_int,
}

/// Discord Message
#[repr(C)]
pub struct DiscordMessage {
    pub id: u64,
    pub channel_id: u64,
    pub author_id: u64,
    pub content: [c_char; 2000],
    pub timestamp: u64,
}

// ===== FFI Function Declarations =====

#[cfg(target_os = "linux")]
#[link(name = "discord_partner_sdk")]
extern "C" {
    // Client Management
    pub fn discord_client_create(client_id: u64, flags: c_int) -> *mut DiscordClient;
    pub fn discord_client_destroy(client: *mut DiscordClient);
    pub fn discord_client_connect(client: *mut DiscordClient) -> c_int;
    pub fn discord_client_disconnect(client: *mut DiscordClient) -> c_int;
    pub fn discord_client_run_callbacks(client: *mut DiscordClient) -> c_int;

    // User Management
    pub fn discord_client_get_current_user(
        client: *mut DiscordClient,
        user: *mut DiscordUser,
    ) -> c_int;

    // Activity/Rich Presence
    pub fn discord_client_activity_update(
        client: *mut DiscordClient,
        activity: *const DiscordActivity,
    ) -> c_int;
    pub fn discord_client_activity_clear(client: *mut DiscordClient) -> c_int;

    // Channel Management
    pub fn discord_client_get_channels(
        client: *mut DiscordClient,
        channels: *mut DiscordChannel,
        count: *mut c_int,
        max_count: c_int,
    ) -> c_int;

    // Messaging
    pub fn discord_client_send_message(
        client: *mut DiscordClient,
        channel_id: u64,
        content: *const c_char,
    ) -> c_int;

    pub fn discord_client_get_messages(
        client: *mut DiscordClient,
        channel_id: u64,
        messages: *mut DiscordMessage,
        count: *mut c_int,
        max_count: c_int,
    ) -> c_int;
}

// ===== Stub FFI for non-Linux platforms =====

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_create(_client_id: u64, _flags: c_int) -> *mut DiscordClient {
    std::ptr::null_mut()
}

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_destroy(_client: *mut DiscordClient) {}

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_connect(_client: *mut DiscordClient) -> c_int {
    -1 // Not implemented on this platform
}

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_disconnect(_client: *mut DiscordClient) -> c_int {
    -1 // Not implemented on this platform
}

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_run_callbacks(_client: *mut DiscordClient) -> c_int {
    -1 // Not implemented on this platform
}

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_get_current_user(
    _client: *mut DiscordClient,
    _user: *mut DiscordUser,
) -> c_int {
    -1 // Not implemented on this platform
}

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_activity_update(
    _client: *mut DiscordClient,
    _activity: *const DiscordActivity,
) -> c_int {
    -1 // Not implemented on this platform
}

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_activity_clear(_client: *mut DiscordClient) -> c_int {
    -1 // Not implemented on this platform
}

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_get_channels(
    _client: *mut DiscordClient,
    _channels: *mut DiscordChannel,
    count: *mut c_int,
    _max_count: c_int,
) -> c_int {
    if !count.is_null() {
        *count = 0;
    }
    -1 // Not implemented on this platform
}

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_send_message(
    _client: *mut DiscordClient,
    _channel_id: u64,
    _content: *const c_char,
) -> c_int {
    -1 // Not implemented on this platform
}

#[cfg(not(target_os = "linux"))]
pub unsafe extern "C" fn discord_client_get_messages(
    _client: *mut DiscordClient,
    _channel_id: u64,
    _messages: *mut DiscordMessage,
    count: *mut c_int,
    _max_count: c_int,
) -> c_int {
    if !count.is_null() {
        *count = 0;
    }
    -1 // Not implemented on this platform
}

// ===== Safe Rust Wrapper =====

#[derive(Debug, thiserror::Error)]
pub enum DiscordError {
    #[error("SDK error: {0}")]
    SdkError(i32),
    #[error("Null pointer error")]
    NullPointer,
    #[error("UTF-8 error: {0}")]
    Utf8Error(#[from] std::ffi::NulError),
    #[error("Invalid state")]
    InvalidState,
}

pub type Result<T> = std::result::Result<T, DiscordError>;

pub struct DiscordClientWrapper {
    client: Arc<Mutex<*mut DiscordClient>>,
    #[allow(dead_code)]
    client_id: u64,
}

impl DiscordClientWrapper {
    pub fn new(client_id: u64) -> Result<Self> {
        unsafe {
            let client = discord_client_create(client_id, 0);
            if client.is_null() {
                return Err(DiscordError::NullPointer);
            }
            Ok(DiscordClientWrapper {
                client: Arc::new(Mutex::new(client)),
                client_id,
            })
        }
    }

    pub fn connect(&self) -> Result<()> {
        unsafe {
            let client = *self.client.lock();
            let result = discord_client_connect(client);
            if result != 0 {
                return Err(DiscordError::SdkError(result));
            }
            Ok(())
        }
    }

    pub fn disconnect(&self) -> Result<()> {
        unsafe {
            let client = *self.client.lock();
            let result = discord_client_disconnect(client);
            if result != 0 {
                return Err(DiscordError::SdkError(result));
            }
            Ok(())
        }
    }

    pub fn run_callbacks(&self) -> Result<()> {
        unsafe {
            let client = *self.client.lock();
            let result = discord_client_run_callbacks(client);
            if result != 0 {
                return Err(DiscordError::SdkError(result));
            }
            Ok(())
        }
    }

    pub fn get_current_user(&self) -> Result<(u64, String)> {
        unsafe {
            let mut user = std::mem::zeroed::<DiscordUser>();
            let client = *self.client.lock();
            let result = discord_client_get_current_user(client, &mut user);
            if result != 0 {
                return Err(DiscordError::SdkError(result));
            }

            let username = CStr::from_ptr(user.username.as_ptr())
                .to_string_lossy()
                .into_owned();
            Ok((user.id, username))
        }
    }

    pub fn send_message(&self, channel_id: u64, content: &str) -> Result<()> {
        let c_content = CString::new(content)?;
        unsafe {
            let client = *self.client.lock();
            let result = discord_client_send_message(client, channel_id, c_content.as_ptr());
            if result != 0 {
                return Err(DiscordError::SdkError(result));
            }
            Ok(())
        }
    }

    pub fn get_channels(&self) -> Result<Vec<(u64, String)>> {
        unsafe {
            let mut channels: Vec<DiscordChannel> = (0..100)
                .map(|_| std::mem::zeroed::<DiscordChannel>())
                .collect();
            let mut count = 0i32;
            let client = *self.client.lock();

            let result = discord_client_get_channels(client, channels.as_mut_ptr(), &mut count, 100);
            if result != 0 {
                return Err(DiscordError::SdkError(result));
            }

            channels.truncate(count as usize);
            let result: Vec<_> = channels
                .iter()
                .map(|ch| {
                    let name = CStr::from_ptr(ch.name.as_ptr())
                        .to_string_lossy()
                        .into_owned();
                    (ch.id, name)
                })
                .collect();
            Ok(result)
        }
    }

    pub fn set_activity(&self, state: &str, details: &str, large_image: &str) -> Result<()> {
        unsafe {
            let mut activity = std::mem::zeroed::<DiscordActivity>();

            // Copy strings into C arrays
            let state_cstr = CString::new(state)?;
            let details_cstr = CString::new(details)?;
            let image_cstr = CString::new(large_image)?;

            std::ptr::copy_nonoverlapping(
                state_cstr.as_ptr() as *const u8,
                activity.state.as_mut_ptr() as *mut u8,
                state_cstr.as_bytes().len().min(127),
            );

            std::ptr::copy_nonoverlapping(
                details_cstr.as_ptr() as *const u8,
                activity.details.as_mut_ptr() as *mut u8,
                details_cstr.as_bytes().len().min(127),
            );

            std::ptr::copy_nonoverlapping(
                image_cstr.as_ptr() as *const u8,
                activity.assets_large_image.as_mut_ptr() as *mut u8,
                image_cstr.as_bytes().len().min(255),
            );

            let client = *self.client.lock();
            let result = discord_client_activity_update(client, &activity);
            if result != 0 {
                return Err(DiscordError::SdkError(result));
            }
            Ok(())
        }
    }

    pub fn clear_activity(&self) -> Result<()> {
        unsafe {
            let client = *self.client.lock();
            let result = discord_client_activity_clear(client);
            if result != 0 {
                return Err(DiscordError::SdkError(result));
            }
            Ok(())
        }
    }
}

impl Drop for DiscordClientWrapper {
    fn drop(&mut self) {
        unsafe {
            let mut client = self.client.lock();
            if !client.is_null() {
                discord_client_destroy(*client);
                *client = ptr::null_mut();
            }
        }
    }
}

// ===== Exported C Functions for Node.js Integration =====

#[no_mangle]
pub extern "C" fn create_discord_client(client_id: u64) -> *mut c_void {
    match DiscordClientWrapper::new(client_id) {
        Ok(client) => Box::into_raw(Box::new(client)) as *mut c_void,
        Err(_) => ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn destroy_discord_client(client: *mut c_void) {
    if !client.is_null() {
        unsafe {
            let _ = Box::from_raw(client as *mut DiscordClientWrapper);
        }
    }
}

#[no_mangle]
pub extern "C" fn client_connect(client: *mut c_void) -> c_int {
    if client.is_null() {
        return -1;
    }
    unsafe {
        let client = &*(client as *mut DiscordClientWrapper);
        match client.connect() {
            Ok(_) => 0,
            Err(_) => -1,
        }
    }
}

#[no_mangle]
pub extern "C" fn client_disconnect(client: *mut c_void) -> c_int {
    if client.is_null() {
        return -1;
    }
    unsafe {
        let client = &*(client as *mut DiscordClientWrapper);
        match client.disconnect() {
            Ok(_) => 0,
            Err(_) => -1,
        }
    }
}

#[no_mangle]
pub extern "C" fn client_run_callbacks(client: *mut c_void) -> c_int {
    if client.is_null() {
        return -1;
    }
    unsafe {
        let client = &*(client as *mut DiscordClientWrapper);
        match client.run_callbacks() {
            Ok(_) => 0,
            Err(_) => -1,
        }
    }
}
