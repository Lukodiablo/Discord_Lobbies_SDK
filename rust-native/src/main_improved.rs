// Improved Discord SDK Rust Subprocess
// Minimal, clean implementation with better error handling

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::ffi::CString;
use std::sync::{Arc, Mutex};
use libc::{c_int, c_char, c_void};
use std::thread;
use std::time::{Duration, Instant};

// ===== FFI Types =====

#[repr(C)]
struct DiscordClient { opaque: *mut c_void }

#[repr(C)]
struct DiscordClientResult { opaque: *mut c_void }

#[repr(C)]
struct DiscordString { ptr: *const c_char, len: usize }

#[repr(C)]
#[derive(Copy, Clone)]
struct DiscordGuildMinimal { id: u64, name: [c_char; 256] }

#[repr(C)]
struct DiscordGuildMinimalSpan { ptr: *mut DiscordGuildMinimal, len: usize }

#[repr(C)]
#[derive(Copy, Clone)]
struct DiscordGuildChannel { id: u64, guild_id: u64, name: [c_char; 100], channel_type: u32 }

#[repr(C)]
struct DiscordGuildChannelSpan { ptr: *mut DiscordGuildChannel, len: usize }

// ===== FFI Bindings =====

#[link(name = "discord_partner_sdk")]
extern "C" {
    fn Discord_Client_Init(client: *mut DiscordClient);
    fn Discord_Client_SetApplicationId(client: *mut DiscordClient, app_id: u64);
    fn Discord_Client_UpdateToken(
        client: *mut DiscordClient, token_type: c_int, token: DiscordString,
        callback: extern "C" fn(*mut DiscordClientResult, *mut c_void),
        free_fn: extern "C" fn(*mut c_void), callback_user_data: *mut c_void
    );
    fn Discord_Client_Connect(client: *mut DiscordClient);
    fn Discord_Client_SetStatusChangedCallback(
        client: *mut DiscordClient,
        callback: extern "C" fn(c_int, c_int, c_int, *mut c_void),
        free_fn: extern "C" fn(*mut c_void), callback_user_data: *mut c_void
    );
    fn Discord_Client_GetUserGuilds(
        client: *mut DiscordClient,
        callback: extern "C" fn(*mut DiscordClientResult, DiscordGuildMinimalSpan, *mut c_void),
        free_fn: extern "C" fn(*mut c_void), callback_user_data: *mut c_void
    );
    fn Discord_Client_GetGuildChannels(
        client: *mut DiscordClient, guild_id: u64,
        callback: extern "C" fn(*mut DiscordClientResult, DiscordGuildChannelSpan, *mut c_void),
        free_fn: extern "C" fn(*mut c_void), callback_user_data: *mut c_void
    );
    fn Discord_RunCallbacks();
    fn Discord_Client_Drop(client: *mut DiscordClient);
    fn Discord_Client_GetStatus(client: *mut DiscordClient) -> c_int;
    fn Discord_GuildMinimal_Id(guild: *mut DiscordGuildMinimal) -> u64;
    fn Discord_GuildMinimal_Name(guild: *mut DiscordGuildMinimal, return_value: *mut DiscordString);
    fn Discord_ClientResult_Successful(result: *mut DiscordClientResult) -> bool;
}

// ===== JSON Protocol =====

#[derive(Deserialize)]
struct Request { id: u64, command: String, args: Option<serde_json::Value> }

#[derive(Serialize)]
struct Response { id: u64, success: bool, result: Option<serde_json::Value>, error: Option<String> }

// ===== Global State =====

struct State {
    client: usize,
    token: Option<CString>,
    status: c_int,
    initialized: bool,
}

static STATE: Mutex<Option<State>> = Mutex::new(None);

// ===== Main Loop =====

fn main() {
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    
    // Background callback processor
    thread::spawn(|| loop {
        unsafe { Discord_RunCallbacks(); }
        if let Ok(guard) = STATE.lock() {
            if let Some(state) = &*guard {
                if state.client != 0 {
                    let client = &mut *(state.client as *mut DiscordClient);
                    unsafe { Discord_Client_GetStatus(client); }
                }
            }
        }
        thread::sleep(Duration::from_millis(10));
    });

    // Command loop
    for line in BufReader::new(stdin.lock()).lines().flatten() {
        if line.trim().is_empty() { continue; }
        if let Ok(req) = serde_json::from_str::<Request>(&line) {
            let resp = handle_command(&req);
            if let Ok(json) = serde_json::to_string(&resp) {
                let _ = writeln!(stdout, "{}", json);
                let _ = stdout.flush();
            }
        }
    }
}

// ===== Command Handler =====

fn handle_command(req: &Request) -> Response {
    let (success, result, error) = match req.command.as_str() {
        "initialize" => init_cmd(req),
        "get_guilds" => guilds_cmd(),
        "get_guild_channels" => channels_cmd(req),
        "disconnect" => disconnect_cmd(),
        "ping" => (true, Some(serde_json::json!({"pong": true})), None),
        _ => (false, None, Some(format!("Unknown: {}", req.command))),
    };
    Response { id: req.id, success, result, error }
}

// ===== Commands =====

fn init_cmd(req: &Request) -> (bool, Option<serde_json::Value>, Option<String>) {
    let args = match &req.args {
        Some(a) => a,
        None => return (false, None, Some("Missing args".into())),
    };
    
    let token = match args.get("token").and_then(|v| v.as_str()) {
        Some(t) => t,
        None => return (false, None, Some("Missing token".into())),
    };
    
    let app_id = args.get("app_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);
    
    match init_discord(token, app_id) {
        Ok(_) => (true, Some(serde_json::json!({"status": "initialized"})), None),
        Err(e) => (false, None, Some(e)),
    }
}

fn guilds_cmd() -> (bool, Option<serde_json::Value>, Option<String>) {
    let guard = STATE.lock().unwrap();
    let state = match &*guard {
        Some(s) if s.initialized => s,
        _ => return (false, None, Some("Not initialized".into())),
    };
    
    let client_ptr = state.client;
    drop(guard);
    
    // Wait for connection
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(3) {
        if let Ok(g) = STATE.lock() {
            if let Some(s) = &*g {
                if s.status >= 1 { break; }
            }
        }
        thread::sleep(Duration::from_millis(100));
    }
    
    // Fetch guilds
    let guilds = Arc::new(Mutex::new(Vec::new()));
    let done = Arc::new(Mutex::new(false));
    
    struct Data { guilds: Arc<Mutex<Vec<serde_json::Value>>>, done: Arc<Mutex<bool>> }
    
    extern "C" fn cb(_: *mut DiscordClientResult, span: DiscordGuildMinimalSpan, ud: *mut c_void) {
        unsafe {
            let data = &*(ud as *mut Data);
            let mut g = data.guilds.lock().unwrap();
            
            if span.ptr.is_null() || span.len == 0 {
                *data.done.lock().unwrap() = true;
                return;
            }
            
            for i in 0..span.len {
                let ptr = span.ptr.add(i);
                let id = Discord_GuildMinimal_Id(ptr);
                let mut name_str = DiscordString { ptr: std::ptr::null(), len: 0 };
                Discord_GuildMinimal_Name(ptr, &mut name_str);
                let name = if !name_str.ptr.is_null() {
                    std::ffi::CStr::from_ptr(name_str.ptr).to_string_lossy().to_string()
                } else {
                    "Unknown".into()
                };
                g.push(serde_json::json!({"id": id.to_string(), "name": name}));
            }
            *data.done.lock().unwrap() = true;
        }
    }
    
    extern "C" fn free(ptr: *mut c_void) {
        if !ptr.is_null() { unsafe { let _ = Box::from_raw(ptr as *mut Data); } }
    }
    
    let data = Box::new(Data { guilds: guilds.clone(), done: done.clone() });
    let ud = Box::into_raw(data) as *mut c_void;
    
    unsafe {
        let client = &mut *(client_ptr as *mut DiscordClient);
        Discord_Client_GetUserGuilds(client, cb, free, ud);
    }
    
    // Wait for completion
    let timeout = Instant::now();
    while timeout.elapsed() < Duration::from_secs(3) {
        if *done.lock().unwrap() { break; }
        thread::sleep(Duration::from_millis(50));
    }
    
    let result = guilds.lock().unwrap().clone();
    if !*done.lock().unwrap() {
        (false, None, Some("Timeout".into()))
    } else {
        (true, Some(serde_json::json!({"guilds": result})), None)
    }
}

fn channels_cmd(req: &Request) -> (bool, Option<serde_json::Value>, Option<String>) {
    let args = match &req.args {
        Some(a) => a,
        None => return (false, None, Some("Missing args".into())),
    };
    
    let guild_id = match args.get("guild_id").and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok()) {
        Some(id) => id,
        None => return (false, None, Some("Invalid guild_id".into())),
    };
    
    let guard = STATE.lock().unwrap();
    let state = match &*guard {
        Some(s) if s.initialized => s,
        _ => return (false, None, Some("Not initialized".into())),
    };
    let client_ptr = state.client;
    drop(guard);
    
    let channels = Arc::new(Mutex::new(Vec::new()));
    let done = Arc::new(Mutex::new(false));
    
    struct Data { channels: Arc<Mutex<Vec<serde_json::Value>>>, done: Arc<Mutex<bool>> }
    
    extern "C" fn cb(_: *mut DiscordClientResult, span: DiscordGuildChannelSpan, ud: *mut c_void) {
        unsafe {
            let data = &*(ud as *mut Data);
            let mut ch = data.channels.lock().unwrap();
            
            if span.ptr.is_null() || span.len == 0 {
                *data.done.lock().unwrap() = true;
                return;
            }
            
            for i in 0..span.len {
                let c = *span.ptr.add(i);
                let mut name = "Unknown".to_string();
                let name_ptr = &c.name[0] as *const c_char;
                if !name_ptr.is_null() {
                    let mut len = 0;
                    for j in 0..c.name.len() {
                        if c.name[j] == 0 { len = j; break; }
                    }
                    if len > 0 {
                        let bytes = std::slice::from_raw_parts(c.name.as_ptr() as *const u8, len + 1);
                        if let Ok(cstr) = std::ffi::CStr::from_bytes_until_nul(bytes) {
                            name = cstr.to_string_lossy().to_string();
                        }
                    }
                }
                ch.push(serde_json::json!({
                    "id": c.id.to_string(),
                    "name": name,
                    "guild_id": c.guild_id.to_string(),
                    "type": c.channel_type,
                }));
            }
            *data.done.lock().unwrap() = true;
        }
    }
    
    extern "C" fn free(ptr: *mut c_void) {
        if !ptr.is_null() { unsafe { let _ = Box::from_raw(ptr as *mut Data); } }
    }
    
    let data = Box::new(Data { channels: channels.clone(), done: done.clone() });
    let ud = Box::into_raw(data) as *mut c_void;
    
    unsafe {
        let client = &mut *(client_ptr as *mut DiscordClient);
        Discord_Client_GetGuildChannels(client, guild_id, cb, free, ud);
    }
    
    let timeout = Instant::now();
    while timeout.elapsed() < Duration::from_secs(5) {
        if *done.lock().unwrap() { break; }
        thread::sleep(Duration::from_millis(50));
    }
    
    let result = channels.lock().unwrap().clone();
    if !*done.lock().unwrap() {
        (false, None, Some(format!("Timeout for guild {}", guild_id)))
    } else {
        (true, Some(serde_json::json!({"channels": result})), None)
    }
}

fn disconnect_cmd() -> (bool, Option<serde_json::Value>, Option<String>) {
    if let Ok(mut guard) = STATE.lock() {
        if let Some(state) = guard.take() {
            if state.client != 0 {
                unsafe {
                    let client = Box::from_raw(state.client as *mut DiscordClient);
                    Discord_Client_Drop(client.as_ref() as *const _ as *mut _);
                }
            }
        }
    }
    (true, Some(serde_json::json!({"status": "disconnected"})), None)
}

// ===== Initialization =====

fn init_discord(token: &str, app_id: u64) -> Result<(), String> {
    unsafe {
        let mut client = Box::new(DiscordClient { opaque: std::ptr::null_mut() });
        Discord_Client_Init(client.as_mut());
        
        if app_id != 0 {
            Discord_Client_SetApplicationId(client.as_mut(), app_id);
        }
        
        extern "C" fn status_cb(status: c_int, _: c_int, _: c_int, _: *mut c_void) {
            if let Ok(mut g) = STATE.lock() {
                if let Some(s) = &mut *g { s.status = status; }
            }
        }
        extern "C" fn status_free(_: *mut c_void) {}
        Discord_Client_SetStatusChangedCallback(client.as_mut(), status_cb, status_free, std::ptr::null_mut());
        
        let token_cstr = CString::new(token).map_err(|_| "Invalid token")?;
        let discord_str = DiscordString { ptr: token_cstr.as_ptr(), len: token.len() };
        
        extern "C" fn token_cb(_: *mut DiscordClientResult, _: *mut c_void) {}
        extern "C" fn token_free(_: *mut c_void) {}
        Discord_Client_UpdateToken(client.as_mut(), 1, discord_str, token_cb, token_free, std::ptr::null_mut());
        
        thread::sleep(Duration::from_millis(100));
        Discord_Client_Connect(client.as_mut());
        
        let client_ptr = Box::into_raw(client) as usize;
        let mut guard = STATE.lock().unwrap();
        *guard = Some(State {
            client: client_ptr,
            token: Some(token_cstr),
            status: 0,
            initialized: true,
        });
        
        Ok(())
    }
}
