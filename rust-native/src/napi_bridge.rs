// Node.js FFI Bridge - Calls Rust Discord SDK Library
// This bridges TypeScript/Node.js with the Rust native library

#[macro_use]
extern crate napi;
extern crate napi_derive;

use napi::{bindgen_prelude::*, JsObject, JsString};
use std::ffi::CStr;

// Import Rust FFI functions
#[link(name = "discord_social_sdk_rust")]
extern "C" {
    fn create_discord_client(client_id: u64) -> *mut std::ffi::c_void;
    fn destroy_discord_client(client: *mut std::ffi::c_void);
    fn client_connect(client: *mut std::ffi::c_void) -> i32;
    fn client_disconnect(client: *mut std::ffi::c_void) -> i32;
    fn client_run_callbacks(client: *mut std::ffi::c_void) -> i32;
}

#[napi]
pub struct DiscordRustClient {
    client_ptr: *mut std::ffi::c_void,
}

#[napi]
impl DiscordRustClient {
    #[napi(constructor)]
    pub fn new(client_id: u64) -> Result<Self> {
        unsafe {
            let ptr = create_discord_client(client_id);
            if ptr.is_null() {
                return Err(Error::new(
                    napi::Status::GenericFailure,
                    "Failed to create Discord client",
                ));
            }
            Ok(DiscordRustClient { client_ptr: ptr })
        }
    }

    #[napi]
    pub fn connect(&self) -> Result<()> {
        unsafe {
            let result = client_connect(self.client_ptr);
            if result != 0 {
                return Err(Error::new(
                    napi::Status::GenericFailure,
                    format!("Connection failed with code {}", result),
                ));
            }
            Ok(())
        }
    }

    #[napi]
    pub fn disconnect(&self) -> Result<()> {
        unsafe {
            let result = client_disconnect(self.client_ptr);
            if result != 0 {
                return Err(Error::new(
                    napi::Status::GenericFailure,
                    format!("Disconnection failed with code {}", result),
                ));
            }
            Ok(())
        }
    }

    #[napi]
    pub fn run_callbacks(&self) -> Result<()> {
        unsafe {
            let result = client_run_callbacks(self.client_ptr);
            if result != 0 {
                return Err(Error::new(
                    napi::Status::GenericFailure,
                    format!("Callback processing failed with code {}", result),
                ));
            }
            Ok(())
        }
    }
}

impl Drop for DiscordRustClient {
    fn drop(&mut self) {
        unsafe {
            if !self.client_ptr.is_null() {
                destroy_discord_client(self.client_ptr);
            }
        }
    }
}
