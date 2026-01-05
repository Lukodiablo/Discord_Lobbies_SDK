use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::ffi::CString;
use std::sync::{Arc, Mutex};
use libc::{c_int, c_void};
use std::thread;
use std::time::Duration;
use lazy_static::lazy_static;

#[repr(C)]
pub struct DiscordClient {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordClientResult {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordString {
    ptr: *const u8,
    size: usize,
}

#[repr(C)]
pub struct DiscordGuildMinimal {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordGuildMinimalSpan {
    ptr: *mut DiscordGuildMinimal,
    len: usize,
}

#[repr(C)]
pub struct DiscordGuildChannel {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordRelationshipHandle {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordRelationshipHandleSpan {
    ptr: *mut DiscordRelationshipHandle,
    size: usize,
}

#[repr(C)]
pub struct DiscordUserHandle {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordLobbyHandle {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordProperties {
    size: usize,
    keys: *mut DiscordString,
    values: *mut DiscordString,
}

#[repr(C)]
pub struct DiscordGuildChannelSpan {
    ptr: *mut DiscordGuildChannel,
    size: usize,
}

#[repr(C)]
#[repr(C)]
#[derive(Copy, Clone, Debug)]
pub struct DiscordUInt64Span {
    ptr: *mut u64,
    size: usize,
}

#[repr(C)]
#[derive(Copy, Clone, Debug)]
#[allow(non_camel_case_types)]
pub struct Discord_Client_Status(c_int);

#[repr(C)]
pub struct DiscordAuthorizationArgs {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordAuthorizationCodeVerifier {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordAuthorizationCodeChallenge {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordMessageHandle {
    opaque: *mut c_void,
}

#[repr(C)]
pub struct DiscordMessageHandleSpan {
    ptr: *mut DiscordMessageHandle,
    size: usize,
}

#[allow(dead_code)]
const DISCORD_CLIENT_STATUS_READY: c_int = 3;

#[link(name = "discord_partner_sdk")]
extern "C" {
    fn Discord_SetFreeThreaded();
    fn Discord_Client_Init(client: *mut DiscordClient);
    fn Discord_Client_SetApplicationId(client: *mut DiscordClient, app_id: u64);
    fn Discord_Client_Authorize(
        client: *mut DiscordClient,
        args: *mut DiscordAuthorizationArgs,
        callback: extern "C" fn(*mut DiscordClientResult, DiscordString, DiscordString, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    fn Discord_AuthorizationArgs_Init(args: *mut DiscordAuthorizationArgs);
    fn Discord_AuthorizationArgs_SetClientId(args: *mut DiscordAuthorizationArgs, client_id: u64);
    fn Discord_AuthorizationArgs_SetScopes(args: *mut DiscordAuthorizationArgs, scopes: DiscordString);
    fn Discord_AuthorizationArgs_SetCodeChallenge(args: *mut DiscordAuthorizationArgs, challenge: *mut DiscordAuthorizationCodeChallenge);
    fn Discord_Client_CreateAuthorizationCodeVerifier(client: *mut DiscordClient, verifier_out: *mut DiscordAuthorizationCodeVerifier);
    fn Discord_AuthorizationCodeVerifier_Challenge(verifier: *mut DiscordAuthorizationCodeVerifier, out: *mut DiscordAuthorizationCodeChallenge);
    fn Discord_AuthorizationCodeChallenge_Challenge(challenge: *mut DiscordAuthorizationCodeChallenge, out: *mut DiscordString);
    fn Discord_AuthorizationCodeVerifier_Verifier(verifier: *mut DiscordAuthorizationCodeVerifier, out: *mut DiscordString);
    fn Discord_Client_GetToken(
        client: *mut DiscordClient,
        app_id: u64,
        code: DiscordString,
        verifier: DiscordString,
        redirect_uri: DiscordString,
        callback: extern "C" fn(*mut DiscordClientResult, DiscordString, DiscordString, c_int, c_int, DiscordString, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    fn Discord_Client_UpdateToken(
        client: *mut DiscordClient,
        token_type: c_int,
        token: DiscordString,
        callback: extern "C" fn(*mut DiscordClientResult, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    fn Discord_Client_Connect(client: *mut DiscordClient);
    fn Discord_Client_SetStatusChangedCallback(
        client: *mut DiscordClient,
        callback: extern "C" fn(c_int, c_int, c_int, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    fn Discord_Client_GetUserGuilds(
        client: *mut DiscordClient,
        callback: extern "C" fn(*mut DiscordClientResult, DiscordGuildMinimalSpan, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    fn Discord_Client_GetGuildChannels(
        client: *mut DiscordClient,
        guild_id: u64,
        callback: extern "C" fn(*mut DiscordClientResult, DiscordGuildChannelSpan, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    fn Discord_RunCallbacks();
    fn Discord_Client_Drop(client: *mut DiscordClient);
    fn Discord_GuildMinimal_Id(guild: *mut DiscordGuildMinimal) -> u64;
    fn Discord_GuildMinimal_Name(guild: *mut DiscordGuildMinimal, return_value: *mut DiscordString);
    fn Discord_GuildChannel_Id(channel: *mut DiscordGuildChannel) -> u64;
    fn Discord_GuildChannel_Name(channel: *mut DiscordGuildChannel, return_value: *mut DiscordString);
    fn Discord_GuildChannel_Type(channel: *mut DiscordGuildChannel) -> c_int;
    
    fn Discord_Client_GetRelationships(client: *mut DiscordClient, return_value: *mut DiscordRelationshipHandleSpan);
    fn Discord_RelationshipHandle_Id(relationship: *mut DiscordRelationshipHandle) -> u64;
    fn Discord_RelationshipHandle_User(relationship: *mut DiscordRelationshipHandle, return_value: *mut DiscordUserHandle) -> bool;
    #[allow(dead_code)]
    fn Discord_UserHandle_Id(user: *mut DiscordUserHandle) -> u64;
    fn Discord_UserHandle_Username(user: *mut DiscordUserHandle, return_value: *mut DiscordString);
    #[allow(dead_code)]
    fn Discord_UserHandle_GlobalName(user: *mut DiscordUserHandle, return_value: *mut DiscordString) -> bool;
    
    fn Discord_Client_SendUserMessage(
        client: *mut DiscordClient,
        recipient_id: u64,
        content: DiscordString,
        callback: extern "C" fn(*mut DiscordClientResult, u64, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    
    #[allow(dead_code)]
    fn Discord_Client_SetMessageCreatedCallback(
        client: *mut DiscordClient,
        callback: extern "C" fn(u64, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    
    fn Discord_Client_GetMessageHandle(
        client: *mut DiscordClient,
        message_id: u64,
        return_value: *mut DiscordMessageHandle,
    ) -> bool;
    
    fn Discord_MessageHandle_Id(handle: *mut DiscordMessageHandle) -> u64;
    fn Discord_MessageHandle_Content(handle: *mut DiscordMessageHandle, return_value: *mut DiscordString);
    fn Discord_MessageHandle_AuthorId(handle: *mut DiscordMessageHandle) -> u64;
    fn Discord_MessageHandle_SentTimestamp(handle: *mut DiscordMessageHandle) -> u64;
    fn Discord_MessageHandle_ChannelId(handle: *mut DiscordMessageHandle) -> u64;
    fn Discord_MessageHandle_Drop(handle: *mut DiscordMessageHandle);
    
    fn Discord_Client_GetLobbyMessagesWithLimit(
        client: *mut DiscordClient,
        lobby_id: u64,
        limit: i32,
        callback: extern "C" fn(*mut DiscordClientResult, DiscordMessageHandleSpan, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    
    fn Discord_Client_GetUserMessagesWithLimit(
        client: *mut DiscordClient,
        recipient_id: u64,
        limit: i32,
        callback: extern "C" fn(*mut DiscordClientResult, DiscordMessageHandleSpan, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );

    fn Discord_Client_SendLobbyMessage(
        client: *mut DiscordClient,
        lobby_id: u64,
        content: DiscordString,
        callback: extern "C" fn(*mut DiscordClientResult, u64, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    fn Discord_Client_CreateOrJoinLobbyWithMetadata(
        client: *mut DiscordClient,
        secret: DiscordString,
        lobby_metadata: DiscordProperties,
        member_metadata: DiscordProperties,
        callback: extern "C" fn(*mut DiscordClientResult, u64, *mut c_void),
        callback_free: Option<extern "C" fn(*mut c_void)>,
        user_data: *mut c_void,
    );
    fn Discord_Client_GetLobbyIds(
        client: *mut DiscordClient,
        return_value: *mut DiscordUInt64Span,
    );
    fn Discord_Client_GetLobbyHandle(
        client: *mut DiscordClient,
        lobby_id: u64,
        return_value: *mut DiscordLobbyHandle,
    ) -> bool;
    fn Discord_LobbyHandle_Metadata(
        handle: *mut DiscordLobbyHandle,
        return_value: *mut DiscordProperties,
    );
    fn Discord_Client_LeaveLobby(
        client: *mut DiscordClient,
        lobby_id: u64,
        callback: extern "C" fn(*mut DiscordClientResult, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    fn Discord_Client_SetSelfMuteAll(client: *mut DiscordClient, mute: bool);
    fn Discord_Client_GetSelfMuteAll(client: *mut DiscordClient) -> bool;
    fn Discord_Client_SetSelfDeafAll(client: *mut DiscordClient, deaf: bool);
    fn Discord_Client_GetSelfDeafAll(client: *mut DiscordClient) -> bool;
    
    fn Discord_Client_StartCall(
        client: *mut DiscordClient,
        channel_id: u64,
        return_value: *mut c_void,
    ) -> bool;
    
    fn Discord_Client_EndCall(
        client: *mut DiscordClient,
        channel_id: u64,
        callback: extern "C" fn(*mut DiscordClientResult, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    
    fn Discord_Client_UpdateRichPresence(
        client: *mut DiscordClient,
        activity: *mut c_void,
        callback: extern "C" fn(*mut DiscordClientResult, *mut c_void),
        free_fn: extern "C" fn(*mut c_void),
        callback_user_data: *mut c_void,
    );
    // Proper Discord SDK error handling functions
    fn Discord_ClientResult_Successful(result: *mut DiscordClientResult) -> bool;
    fn Discord_ClientResult_ErrorCode(result: *mut DiscordClientResult) -> i32;
    fn Discord_ClientResult_Error(result: *mut DiscordClientResult, error_out: *mut DiscordString);
}

#[derive(Debug, Serialize, Deserialize)]
struct Request {
    id: u64,
    command: String,
    args: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Response {
    id: u64,
    success: bool,
    result: Option<serde_json::Value>,
    error: Option<String>,
}

lazy_static! {
    static ref CLIENT_PTR: Arc<Mutex<usize>> = Arc::new(Mutex::new(0));
    static ref TOKEN: Arc<Mutex<Option<CString>>> = Arc::new(Mutex::new(None));
    static ref INITIALIZED: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
    static ref CURRENT_STATUS: Arc<Mutex<c_int>> = Arc::new(Mutex::new(0));
    static ref CURRENT_APP_ID: Arc<Mutex<u64>> = Arc::new(Mutex::new(0));
    static ref MESSAGE_EVENTS: Arc<Mutex<Vec<(u64, String)>>> = Arc::new(Mutex::new(Vec::new()));
}

fn main() {
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    
    eprintln!("[Rust] Discord subprocess starting...");

    // Main command processing loop
    eprintln!("[Rust] Entering command loop...");
    let stdin_handle = stdin.lock();
    let reader = BufReader::new(stdin_handle);
    
    eprintln!("[Rust] Subprocess ready, waiting for commands...");
    for line in reader.lines() {
        match line {
            Ok(json_line) => {
                let trimmed = json_line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                
                match serde_json::from_str::<Request>(trimmed) {
                    Ok(req) => {
                        if req.command != "get_message_events" {
                            eprintln!("[Rust] Processing command: {}", req.command);
                        }
                        let resp = handle_command(&req);
                        
                        match serde_json::to_string(&resp) {
                            Ok(json) => {
                                if req.command != "get_message_events" {
                                    eprintln!("[Rust] Sending response: {} bytes", json.len());
                                }
                                if let Err(e) = writeln!(stdout, "{}", json) {
                                    eprintln!("[Rust] ERROR writing to stdout: {}", e);
                                    break;
                                }
                                if let Err(e) = stdout.flush() {
                                    eprintln!("[Rust] ERROR flushing stdout: {}", e);
                                    break;
                                }
                                // Give TypeScript time to read the response
                                thread::sleep(Duration::from_millis(200));
                            }
                            Err(e) => {
                                eprintln!("[Rust] ERROR serializing response: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[Rust] ERROR parsing JSON: {}", e);
                    }
                }
            }
            Err(e) => {
                eprintln!("[Rust] Error reading stdin: {}", e);
                break;
            }
        }
    }
    
    eprintln!("[Rust] Command loop ended, cleaning up...");
    cleanup();
}

fn handle_command(req: &Request) -> Response {
    let (success, result, error) = match req.command.as_str() {
        "initialize" => {
            if let Some(args) = &req.args {
                if let Some(token) = args.get("token").and_then(|v| v.as_str()) {
                    // Parse optional app_id (as string that needs to be converted to u64)
                    let app_id = args.get("app_id")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<u64>().ok())
                        .unwrap_or(0);
                    
                    eprintln!("[Rust] Initialize request: app_id={}, token_len={}", app_id, token.len());
                    match init_discord_sdk(token, app_id) {
                        Ok(msg) => (true, Some(serde_json::json!({"status": msg})), None),
                        Err(e) => (false, None, Some(e)),
                    }
                } else {
                    (false, None, Some("Missing token".to_string()))
                }
            } else {
                (false, None, Some("Missing args".to_string()))
            }
        }
        "disconnect" => {
            cleanup();
            (true, Some(serde_json::json!({"status": "disconnected"})), None)
        }
        "get_guilds" => {
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else {
                drop(initialized);
                
                // Poll SDK repeatedly to ensure callbacks are processed
                eprintln!("[Rust] Calling Discord_Client_GetUserGuilds...");
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let guilds: Arc<Mutex<Vec<serde_json::Value>>> = Arc::new(Mutex::new(Vec::new()));
                        let completed = Arc::new(Mutex::new(false));
                        let error_msg = Arc::new(Mutex::new(String::new()));
                        
                        let guilds_clone = Arc::clone(&guilds);
                        let completed_clone = Arc::clone(&completed);
                        let error_clone = Arc::clone(&error_msg);
                        
                        extern "C" fn guilds_callback(
                            _result: *mut DiscordClientResult,
                            span: DiscordGuildMinimalSpan,
                            user_data: *mut c_void,
                        ) {
                            eprintln!("[Rust] 🎯 GetUserGuilds callback FIRED! span.len={}", span.len);
                            
                            unsafe {
                                let data = &*(user_data as *mut (Arc<Mutex<Vec<serde_json::Value>>>, Arc<Mutex<bool>>, Arc<Mutex<String>>));
                                
                                if span.ptr.is_null() {
                                    eprintln!("[Rust] Span pointer is null");
                                    *data.2.lock().unwrap() = "Null span pointer".to_string();
                                    *data.1.lock().unwrap() = true;
                                    return;
                                }
                                
                                if span.len == 0 {
                                    eprintln!("[Rust] SDK returned 0 guilds (empty span)");
                                    *data.1.lock().unwrap() = true;
                                    return;
                                }
                                
                                eprintln!("[Rust] Processing {} guilds from SDK", span.len);
                                let mut g = data.0.lock().unwrap();
                                
                                for i in 0..span.len {
                                    let guild_ptr = span.ptr.add(i);
                                    let guild_id = Discord_GuildMinimal_Id(guild_ptr);
                                    
                                    let mut name_str = DiscordString {
                                        ptr: std::ptr::null(),
                                        size: 0,
                                    };
                                    Discord_GuildMinimal_Name(guild_ptr, &mut name_str);
                                    
                                    let name = if !name_str.ptr.is_null() && name_str.size > 0 {
                                        String::from_utf8_lossy(std::slice::from_raw_parts(name_str.ptr, name_str.size)).to_string()
                                    } else {
                                        "Unknown".to_string()
                                    };
                                    
                                    // Skip verbose guild logging
                                    g.push(serde_json::json!({
                                        "id": guild_id.to_string(),
                                        "name": name,
                                    }));
                                }
                                
                                *data.1.lock().unwrap() = true;
                            }
                        }

                        extern "C" fn guilds_free(ptr: *mut c_void) {
                            if !ptr.is_null() {
                                unsafe {
                                    let _ = Box::from_raw(ptr as *mut (Arc<Mutex<Vec<serde_json::Value>>>, Arc<Mutex<bool>>, Arc<Mutex<String>>));
                                }
                            }
                        }
                        
                        let user_data = Box::into_raw(Box::new((guilds_clone, completed_clone, error_clone))) as *mut c_void;
                        
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        unsafe {
                            Discord_Client_GetUserGuilds(client_ref, guilds_callback, guilds_free, user_data);
                        }
                        eprintln!("[Rust] GetUserGuilds called, now polling for callback...");
                        
                        // Poll hard for callback - call Discord_RunCallbacks aggressively
                        let timeout = std::time::Instant::now();
                        while timeout.elapsed() < Duration::from_secs(15) {
                            unsafe {
                                Discord_RunCallbacks();
                            }
                            if *completed.lock().unwrap() { 
                                eprintln!("[Rust] Callback completed!");
                                break; 
                            }
                            thread::sleep(Duration::from_millis(50)); // Balanced polling
                        }
                        
                        let fetched_guilds = guilds.lock().unwrap().clone();
                        let is_completed = *completed.lock().unwrap();
                        let error = error_msg.lock().unwrap().clone();
                        
                        eprintln!("[Rust] Callback completed={}, guilds fetched={}, elapsed={:.2}s", is_completed, fetched_guilds.len(), timeout.elapsed().as_secs_f64());
                        
                        if fetched_guilds.is_empty() && !error.is_empty() {
                            (false, None, Some(error))
                        } else {
                            (true, Some(serde_json::json!({"guilds": fetched_guilds})), None)
                        }
                    } else {
                        eprintln!("[Rust] ERROR: Client pointer is NULL!");
                        (false, None, Some("Client not initialized".to_string()))
                    }
                } else {
                    eprintln!("[Rust] ERROR: Failed to lock CLIENT_PTR!");
                    (false, None, Some("Failed to lock client".to_string()))
                }
            }
        }
        "get_guild_channels" => {
            if let Some(args) = &req.args {
                if let Some(guild_id_str) = args.get("guild_id").and_then(|v| v.as_str()) {
                    if let Ok(guild_id) = guild_id_str.parse::<u64>() {
                        let initialized = INITIALIZED.lock().unwrap();
                        if !*initialized {
                                (false, None, Some("SDK not initialized".to_string()))
                        } else {
                            drop(initialized);
                            
                            struct ChannelFetchData {
                                    channels: Arc<Mutex<Vec<serde_json::Value>>>,
                                    completed: Arc<Mutex<bool>>,
                                }

                                let channels: Arc<Mutex<Vec<serde_json::Value>>> = Arc::new(Mutex::new(Vec::new()));
                                let channels_completed = Arc::new(Mutex::new(false));
                                let channels_clone = Arc::clone(&channels);
                                let channels_completed_clone = Arc::clone(&channels_completed);
                                
                            extern "C" fn channels_callback(
                                _result: *mut DiscordClientResult,
                                    span: DiscordGuildChannelSpan,
                                    user_data: *mut c_void,
                                ) {
                                    let fetch_data_ptr = user_data as *mut ChannelFetchData;
                                    unsafe {
                                        let fetch_data = &*fetch_data_ptr;
                                        let mut ch = fetch_data.channels.lock().unwrap();
                                        
                                        if span.ptr.is_null() || span.size == 0 {
                                            *fetch_data.completed.lock().unwrap() = true;
                                            return;
                                        }
                                        
                                        for i in 0..span.size {
                                            let channel_ptr = span.ptr.add(i);
                                            
                                            let channel_id = Discord_GuildChannel_Id(channel_ptr);
                                            let channel_type = Discord_GuildChannel_Type(channel_ptr);
                                            
                                            let mut name_str = DiscordString {
                                                ptr: std::ptr::null(),
                                                size: 0,
                                            };
                                            Discord_GuildChannel_Name(channel_ptr, &mut name_str);
                                            
                                            let name = if !name_str.ptr.is_null() && name_str.size > 0 {
                                                String::from_utf8_lossy(std::slice::from_raw_parts(name_str.ptr, name_str.size)).to_string()
                                            } else {
                                                "Unknown".to_string()
                                            };
                                            
                                            ch.push(serde_json::json!({
                                                "id": channel_id.to_string(),
                                                "name": name,
                                                "type": channel_type,
                                            }));
                                        }
                                        
                                        // Signal completion (BUG FIX #1)
                                        *fetch_data.completed.lock().unwrap() = true;
                                    }
                                }
                                
                            extern "C" fn channels_free(ptr: *mut c_void) {
                                    if !ptr.is_null() {
                                        unsafe {
                                            let _ = Box::from_raw(ptr as *mut ChannelFetchData);
                                        }
                                    }
                                }
                                
                            let fetch_data = Box::new(ChannelFetchData {
                                    channels: channels_clone,
                                    completed: channels_completed_clone,
                                });
                                let user_data = Box::into_raw(fetch_data) as *mut c_void;
                                
                            if let Ok(client_guard) = CLIENT_PTR.lock() {
                                if *client_guard != 0 {
                                    let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                                    unsafe {
                                        Discord_Client_GetGuildChannels(client_ref, guild_id, channels_callback, channels_free, user_data);
                                    }
                                }
                            }
                                
                            let timeout = std::time::Instant::now();
                            while timeout.elapsed() < Duration::from_secs(5) {
                                unsafe { Discord_RunCallbacks(); }
                                if *channels_completed.lock().unwrap() { break; }
                                thread::sleep(Duration::from_millis(50));
                            }
                            
                            let fetched_channels = channels.lock().unwrap().clone();
                            
                            if !*channels_completed.lock().unwrap() {
                                (false, None, Some(format!("Timeout for guild {}", guild_id)))
                            } else {
                                (true, Some(serde_json::json!({"channels": fetched_channels})), None)
                            }
                        }
                    } else {
                        (false, None, Some("Invalid guild_id".to_string()))
                    }
                } else {
                    (false, None, Some("Missing guild_id".to_string()))
                }
            } else {
                (false, None, Some("Missing args".to_string()))
            }
        }
        "send_message" => {
            if let Some(args) = &req.args {
                if let (Some(channel_id_str), Some(content)) = (
                    args.get("channel_id").and_then(|v| v.as_str()),
                    args.get("content").and_then(|v| v.as_str())
                ) {
                    if let Ok(channel_id) = channel_id_str.parse::<u64>() {
                        let initialized = INITIALIZED.lock().unwrap();
                        if !*initialized {
                            (false, None, Some("SDK not initialized".to_string()))
                        } else {
                            drop(initialized);
                            
                            let content_cstr = match CString::new(content) {
                                Ok(s) => s,
                                Err(_) => {
                                    return Response {
                                        id: req.id,
                                        success: false,
                                        result: None,
                                        error: Some("Invalid content".to_string()),
                                    };
                                }
                            };
                            
                            let discord_str = DiscordString {
                                ptr: content_cstr.as_ptr() as *const u8,
                                size: content.len(),
                            };
                            
                            let sent = Arc::new(Mutex::new(false));
                            let sent_clone = Arc::clone(&sent);
                            
                            extern "C" fn msg_cb(_result: *mut DiscordClientResult, _: u64, ud: *mut c_void) {
                                unsafe {
                                    let sent = &*(ud as *const Arc<Mutex<bool>>);
                                    *sent.lock().unwrap() = true;
                                }
                            }
                            extern "C" fn msg_free(_: *mut c_void) {}
                            
                            let ud = Box::into_raw(Box::new(sent_clone)) as *mut c_void;
                            
                            if let Ok(client_guard) = CLIENT_PTR.lock() {
                                if *client_guard != 0 {
                                    let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                                    unsafe {
                                        Discord_Client_SendLobbyMessage(client_ref, channel_id, discord_str, msg_cb, msg_free, ud);
                                    }
                                }
                            }
                            
                            let timeout = std::time::Instant::now();
                            while timeout.elapsed() < Duration::from_secs(5) {
                                unsafe { Discord_RunCallbacks(); }
                                if *sent.lock().unwrap() { break; }
                                thread::sleep(Duration::from_millis(50));
                            }
                            
                            if *sent.lock().unwrap() {
                                (true, Some(serde_json::json!({"sent": true})), None)
                            } else {
                                (false, None, Some("Message send timeout".to_string()))
                            }
                        }
                    } else {
                        (false, None, Some("Invalid channel_id".to_string()))
                    }
                } else {
                    (false, None, Some("Missing channel_id or content".to_string()))
                }
            } else {
                (false, None, Some("Missing args".to_string()))
            }
        }
        "set_activity" => {
            if let Some(args) = &req.args {
                let _state = args.get("state").and_then(|v| v.as_str()).unwrap_or("");
                let _details = args.get("details").and_then(|v| v.as_str()).unwrap_or("");
                
                let initialized = INITIALIZED.lock().unwrap();
                if !*initialized {
                    (false, None, Some("SDK not initialized".to_string()))
                } else {
                    drop(initialized);
                    
                    let done = Arc::new(Mutex::new(false));
                    let done_clone = Arc::clone(&done);
                    
                    extern "C" fn activity_cb(_result: *mut DiscordClientResult, ud: *mut c_void) {
                        unsafe {
                            let done = &*(ud as *const Arc<Mutex<bool>>);
                            *done.lock().unwrap() = true;
                        }
                    }
                    extern "C" fn activity_free(_: *mut c_void) {}
                    
                    let ud = Box::into_raw(Box::new(done_clone)) as *mut c_void;
                    
                    if let Ok(client_guard) = CLIENT_PTR.lock() {
                        if *client_guard != 0 {
                            let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                            unsafe {
                                Discord_Client_UpdateRichPresence(client_ref, std::ptr::null_mut(), activity_cb, activity_free, ud);
                            }
                        }
                    }
                    
                    let timeout = std::time::Instant::now();
                    while timeout.elapsed() < Duration::from_secs(3) {
                        unsafe { Discord_RunCallbacks(); }
                        if *done.lock().unwrap() { break; }
                        thread::sleep(Duration::from_millis(50));
                    }
                    
                    if *done.lock().unwrap() {
                        (true, Some(serde_json::json!({"updated": true})), None)
                    } else {
                        (false, None, Some("Activity update timeout".to_string()))
                    }
                }
            } else {
                (false, None, Some("Missing args".to_string()))
            }
        }
        "get_relationships" => {
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else {
                drop(initialized);
                
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        
                        let mut span = DiscordRelationshipHandleSpan {
                            ptr: std::ptr::null_mut(),
                            size: 0,
                        };
                        
                        unsafe {
                            Discord_Client_GetRelationships(client_ref, &mut span);
                        }
                        
                        let mut friends = Vec::new();
                        
                        if !span.ptr.is_null() && span.size > 0 {
                            for i in 0..span.size {
                                unsafe {
                                    let rel_ptr = span.ptr.add(i);
                                    let user_id = Discord_RelationshipHandle_Id(rel_ptr);
                                    
                                    let mut user_handle = DiscordUserHandle { opaque: std::ptr::null_mut() };
                                    let has_user = Discord_RelationshipHandle_User(rel_ptr, &mut user_handle);
                                    
                                    if has_user && !user_handle.opaque.is_null() {
                                        let mut username_str = DiscordString {
                                            ptr: std::ptr::null(),
                                            size: 0,
                                        };
                                        Discord_UserHandle_Username(&mut user_handle, &mut username_str);
                                        
                                        let username = if !username_str.ptr.is_null() && username_str.size > 0 {
                                            String::from_utf8_lossy(std::slice::from_raw_parts(username_str.ptr, username_str.size)).to_string()
                                        } else {
                                            "Unknown".to_string()
                                        };
                                        
                                        friends.push(serde_json::json!({
                                            "id": user_id.to_string(),
                                            "username": username,
                                        }));
                                    }
                                }
                            }
                        }
                        
                        (true, Some(serde_json::json!({"friends": friends})), None)
                    } else {
                        (false, None, Some("Client not initialized".to_string()))
                    }
                } else {
                    (false, None, Some("Failed to lock client".to_string()))
                }
            }
        }
        "get_lobby_ids" => {
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else {
                drop(initialized);
                
                eprintln!("[Rust] Getting lobby IDs...");
                
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        
                        // Ensure SDK is ready to respond
                        unsafe {
                            Discord_RunCallbacks();
                        }
                        
                        // Call GetLobbyIds with output parameter (correct calling convention)
                        let mut span = DiscordUInt64Span {
                            ptr: std::ptr::null_mut(),
                            size: 0,
                        };
                        
                        unsafe {
                            Discord_Client_GetLobbyIds(client_ref, &mut span);
                        }
                        
                        eprintln!("[Rust] GetLobbyIds returned, span.size={}, span.ptr={:?}", span.size, span.ptr);
                        
                        let mut lobby_ids = Vec::new();
                        
                        // Copy lobby IDs immediately
                        if !span.ptr.is_null() && span.size > 0 && span.size < 1000 {
                            for i in 0..span.size {
                                unsafe {
                                    let lobby_id = *span.ptr.add(i);
                                    lobby_ids.push(lobby_id.to_string());
                                }
                            }
                            eprintln!("[Rust] ✅ Successfully fetched {} lobby IDs", lobby_ids.len());
                        } else {
                            eprintln!("[Rust] No lobbies or invalid span");
                        }
                        
                        // Process callbacks after copying data
                        unsafe {
                            Discord_RunCallbacks();
                        }
                        
                        (true, Some(serde_json::json!({"lobby_ids": lobby_ids})), None)
                    } else {
                        eprintln!("[Rust] ERROR: Client pointer is NULL!");
                        (false, None, Some("Client not initialized".to_string()))
                    }
                } else {
                    eprintln!("[Rust] ERROR: Failed to lock CLIENT_PTR!");
                    (false, None, Some("Failed to lock client".to_string()))
                }
            }
        }
        "get_lobby" => {
            let lobby_id = req.args.as_ref()
                .and_then(|a| a.get("lobby_id"))
                .and_then(|v| {
                    if let Some(n) = v.as_u64() { Some(n) }
                    else if let Some(s) = v.as_str() { s.parse::<u64>().ok() }
                    else { None }
                })
                .unwrap_or(0);

            if lobby_id == 0 {
                (false, None, Some("Invalid lobby ID".to_string()))
            } else {
                let initialized = INITIALIZED.lock().unwrap();
                if !*initialized {
                    (false, None, Some("SDK not initialized".to_string()))
                } else {
                    drop(initialized);
                    
                    if let Ok(client_guard) = CLIENT_PTR.lock() {
                        if *client_guard != 0 {
                            let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                            
                            // Run callbacks to process pending operations
                            unsafe {
                                Discord_RunCallbacks();
                            }
                            
                            // Get the lobby handle
                            let mut lobby_handle: DiscordLobbyHandle = DiscordLobbyHandle {
                                opaque: std::ptr::null_mut(),
                            };
                            
                            let success = unsafe {
                                Discord_Client_GetLobbyHandle(client_ref, lobby_id, &mut lobby_handle)
                            };
                            
                            if success && !lobby_handle.opaque.is_null() {
                                // Get metadata from the handle
                                let mut metadata: DiscordProperties = DiscordProperties {
                                    size: 0,
                                    keys: std::ptr::null_mut(),
                                    values: std::ptr::null_mut(),
                                };
                                
                                unsafe {
                                    Discord_LobbyHandle_Metadata(&mut lobby_handle, &mut metadata);
                                }
                                
                                // Parse metadata properties
                                let mut metadata_map = serde_json::json!({});
                                
                                if metadata.size > 0 && !metadata.keys.is_null() && !metadata.values.is_null() {
                                    for i in 0..metadata.size {
                                        unsafe {
                                            let key_ptr = (*metadata.keys.add(i)).ptr;
                                            let key_len = (*metadata.keys.add(i)).size;
                                            let value_ptr = (*metadata.values.add(i)).ptr;
                                            let value_len = (*metadata.values.add(i)).size;
                                            
                                            if !key_ptr.is_null() && !value_ptr.is_null() {
                                                let key_str = String::from_utf8_lossy(std::slice::from_raw_parts(key_ptr, key_len)).to_string();
                                                let value_str = String::from_utf8_lossy(std::slice::from_raw_parts(value_ptr, value_len)).to_string();
                                                metadata_map[&key_str] = serde_json::Value::String(value_str);
                                            }
                                        }
                                    }
                                }
                                
                                eprintln!("[Rust] ✅ Fetched lobby {}: {:?}", lobby_id, metadata_map);
                                (true, Some(serde_json::json!({
                                    "lobby_id": lobby_id,
                                    "metadata": metadata_map
                                })), None)
                            } else {
                                eprintln!("[Rust] Failed to get lobby handle for {}", lobby_id);
                                (false, None, Some(format!("Failed to get lobby handle for {}", lobby_id)))
                            }
                        } else {
                            eprintln!("[Rust] ERROR: Client pointer is NULL!");
                            (false, None, Some("Client not initialized".to_string()))
                        }
                    } else {
                        eprintln!("[Rust] ERROR: Failed to lock CLIENT_PTR!");
                        (false, None, Some("Failed to lock client".to_string()))
                    }
                }
            }
        }
        "send_dm" => {
            if let Some(args) = &req.args {
                if let (Some(recipient_id_str), Some(content)) = (
                    args.get("recipient_id").and_then(|v| v.as_str()),
                    args.get("content").and_then(|v| v.as_str())
                ) {
                    if let Ok(recipient_id) = recipient_id_str.parse::<u64>() {
                        let initialized = INITIALIZED.lock().unwrap();
                        if !*initialized {
                            (false, None, Some("SDK not initialized".to_string()))
                        } else {
                            drop(initialized);
                            
                            let content_cstr = match CString::new(content) {
                                Ok(s) => s,
                                Err(_) => {
                                    return Response {
                                        id: req.id,
                                        success: false,
                                        result: None,
                                        error: Some("Invalid content".to_string()),
                                    };
                                }
                            };
                            
                            let discord_str = DiscordString {
                                ptr: content_cstr.as_ptr() as *const u8,
                                size: content.len(),
                            };
                            
                            let sent = Arc::new(Mutex::new(false));
                            let message_id = Arc::new(Mutex::new(0u64));
                            let sent_clone = Arc::clone(&sent);
                            let message_id_clone = Arc::clone(&message_id);
                            
                            struct DmData {
                                sent: Arc<Mutex<bool>>,
                                message_id: Arc<Mutex<u64>>,
                            }
                            
                            extern "C" fn dm_callback(_result: *mut DiscordClientResult, msg_id: u64, user_data: *mut c_void) {
                                unsafe {
                                    let data = &*(user_data as *const DmData);
                                    *data.message_id.lock().unwrap() = msg_id;
                                    *data.sent.lock().unwrap() = true;
                                }
                            }
                            extern "C" fn dm_free(ptr: *mut c_void) {
                                if !ptr.is_null() {
                                    unsafe { let _ = Box::from_raw(ptr as *mut DmData); }
                                }
                            }
                            
                            let dm_data = Box::new(DmData {
                                sent: sent_clone,
                                message_id: message_id_clone,
                            });
                            let user_data = Box::into_raw(dm_data) as *mut c_void;
                            
                            if let Ok(client_guard) = CLIENT_PTR.lock() {
                                if *client_guard != 0 {
                                    let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                                    unsafe {
                                        Discord_Client_SendUserMessage(client_ref, recipient_id, discord_str, dm_callback, dm_free, user_data);
                                    }
                                }
                            }
                            
                            let timeout = std::time::Instant::now();
                            while timeout.elapsed() < Duration::from_secs(5) {
                                unsafe { Discord_RunCallbacks(); }
                                if *sent.lock().unwrap() { break; }
                                thread::sleep(Duration::from_millis(50));
                            }
                            
                            if *sent.lock().unwrap() {
                                let msg_id = *message_id.lock().unwrap();
                                (true, Some(serde_json::json!({"message_id": msg_id.to_string()})), None)
                            } else {
                                (false, None, Some("DM send timeout".to_string()))
                            }
                        }
                    } else {
                        (false, None, Some("Invalid recipient_id".to_string()))
                    }
                } else {
                    (false, None, Some("Missing recipient_id or content".to_string()))
                }
            } else {
                (false, None, Some("Missing args".to_string()))
            }
        }
        "get_lobby_messages" => {
            if let Some(args) = &req.args {
                if let Some(lobby_id_str) = args.get("lobby_id").and_then(|v| v.as_str()) {
                    if let Ok(lobby_id) = lobby_id_str.parse::<u64>() {
                        let initialized = INITIALIZED.lock().unwrap();
                        if !*initialized {
                            (false, None, Some("SDK not initialized".to_string()))
                        } else {
                            drop(initialized);
                            
                            let limit = args.get("limit")
                                .and_then(|v| v.as_i64())
                                .unwrap_or(50) as i32;
                            
                            eprintln!("[Rust] Getting lobby messages: lobby_id={}, limit={}", lobby_id, limit);
                            
                            struct MessageFetchData {
                                messages: Arc<Mutex<Vec<serde_json::Value>>>,
                                completed: Arc<Mutex<bool>>,
                            }
                            
                            let messages: Arc<Mutex<Vec<serde_json::Value>>> = Arc::new(Mutex::new(Vec::new()));
                            let completed: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
                            let messages_clone = Arc::clone(&messages);
                            let completed_clone = Arc::clone(&completed);
                            
                            extern "C" fn messages_callback(
                                _result: *mut DiscordClientResult,
                                span: DiscordMessageHandleSpan,
                                user_data: *mut c_void,
                            ) {
                                eprintln!("[Rust] 💬 GetLobbyMessages callback FIRED!");
                                
                                unsafe {
                                    let fetch_data_ptr = user_data as *mut MessageFetchData;
                                    let fetch_data = &*fetch_data_ptr;
                                    let mut msg_vec = fetch_data.messages.lock().unwrap();
                                    
                                    if span.ptr.is_null() || span.size == 0 {
                                        eprintln!("[Rust] No messages or empty span");
                                        *fetch_data.completed.lock().unwrap() = true;
                                        return;
                                    }
                                    
                                    eprintln!("[Rust] Found {} messages", span.size);
                                    
                                    for i in 0..span.size {
                                        let msg_handle_ptr = span.ptr.add(i);
                                        
                                        let msg_id = Discord_MessageHandle_Id(msg_handle_ptr);
                                        let author_id = Discord_MessageHandle_AuthorId(msg_handle_ptr);
                                        let timestamp = Discord_MessageHandle_SentTimestamp(msg_handle_ptr);
                                        let channel_id = Discord_MessageHandle_ChannelId(msg_handle_ptr);
                                        
                                        let mut content_str = DiscordString {
                                            ptr: std::ptr::null(),
                                            size: 0,
                                        };
                                        Discord_MessageHandle_Content(msg_handle_ptr, &mut content_str);
                                        
                                        let content = if !content_str.ptr.is_null() && content_str.size > 0 {
                                            String::from_utf8_lossy(std::slice::from_raw_parts(content_str.ptr, content_str.size)).to_string()
                                        } else {
                                            "".to_string()
                                        };
                                        
                                        msg_vec.push(serde_json::json!({
                                            "id": msg_id.to_string(),
                                            "author_id": author_id.to_string(),
                                            "channel_id": channel_id.to_string(),
                                            "content": content,
                                            "timestamp": timestamp,
                                        }));
                                        
                                        eprintln!("[Rust] Message {}: {} (author: {})", msg_id, content, author_id);
                                    }
                                    
                                    *fetch_data.completed.lock().unwrap() = true;
                                }
                            }
                            
                            extern "C" fn messages_free(ptr: *mut c_void) {
                                if !ptr.is_null() {
                                    unsafe {
                                        let _ = Box::from_raw(ptr as *mut MessageFetchData);
                                    }
                                }
                            }
                            
                            let fetch_data = Box::new(MessageFetchData {
                                messages: messages_clone,
                                completed: completed_clone,
                            });
                            let user_data = Box::into_raw(fetch_data) as *mut c_void;
                            
                            if let Ok(client_guard) = CLIENT_PTR.lock() {
                                if *client_guard != 0 {
                                    let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                                    unsafe {
                                        Discord_Client_GetLobbyMessagesWithLimit(
                                            client_ref,
                                            lobby_id,
                                            limit,
                                            messages_callback,
                                            messages_free,
                                            user_data,
                                        );
                                    }
                                    eprintln!("[Rust] GetLobbyMessagesWithLimit called");
                                }
                            }
                            
                            let timeout = std::time::Instant::now();
                            while timeout.elapsed() < Duration::from_secs(5) {
                                unsafe { Discord_RunCallbacks(); }
                                if *completed.lock().unwrap() { break; }
                                thread::sleep(Duration::from_millis(50));
                            }
                            
                            let fetched_messages = messages.lock().unwrap().clone();
                            eprintln!("[Rust] Fetched {} messages from lobby", fetched_messages.len());
                            
                            if !*completed.lock().unwrap() {
                                (false, None, Some("Message fetch timeout".to_string()))
                            } else {
                                (true, Some(serde_json::json!({"messages": fetched_messages})), None)
                            }
                        }
                    } else {
                        (false, None, Some("Invalid lobby_id".to_string()))
                    }
                } else {
                    (false, None, Some("Missing lobby_id".to_string()))
                }
            } else {
                (false, None, Some("Missing args".to_string()))
            }
        }
        "get_message" => {
            if let Some(args) = &req.args {
                if let Some(message_id_str) = args.get("message_id").and_then(|v| v.as_str()) {
                    if let Ok(message_id) = message_id_str.parse::<u64>() {
                        let initialized = INITIALIZED.lock().unwrap();
                        if !*initialized {
                            (false, None, Some("SDK not initialized".to_string()))
                        } else {
                            drop(initialized);
                            
                            eprintln!("[Rust] Getting message: message_id={}", message_id);
                            
                            if let Ok(client_guard) = CLIENT_PTR.lock() {
                                if *client_guard != 0 {
                                    let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                                    
                                    let mut msg_handle = DiscordMessageHandle { opaque: std::ptr::null_mut() };
                                    let found = unsafe {
                                        Discord_Client_GetMessageHandle(client_ref, message_id, &mut msg_handle)
                                    };
                                    
                                    if found && !msg_handle.opaque.is_null() {
                                        let msg_id = unsafe { Discord_MessageHandle_Id(&mut msg_handle) };
                                        let author_id = unsafe { Discord_MessageHandle_AuthorId(&mut msg_handle) };
                                        let timestamp = unsafe { Discord_MessageHandle_SentTimestamp(&mut msg_handle) };
                                        let channel_id = unsafe { Discord_MessageHandle_ChannelId(&mut msg_handle) };
                                        
                                        let mut content_str = DiscordString {
                                            ptr: std::ptr::null(),
                                            size: 0,
                                        };
                                        unsafe {
                                            Discord_MessageHandle_Content(&mut msg_handle, &mut content_str);
                                        }
                                        
                                        let content = unsafe {
                                            if !content_str.ptr.is_null() && content_str.size > 0 {
                                                String::from_utf8_lossy(std::slice::from_raw_parts(content_str.ptr, content_str.size)).to_string()
                                            } else {
                                                "".to_string()
                                            }
                                        };
                                        
                                        eprintln!("[Rust] Message found: {} - {}", msg_id, content);
                                        
                                        unsafe {
                                            Discord_MessageHandle_Drop(&mut msg_handle);
                                        }
                                        
                                        (true, Some(serde_json::json!({
                                            "id": msg_id.to_string(),
                                            "author_id": author_id.to_string(),
                                            "channel_id": channel_id.to_string(),
                                            "content": content,
                                            "timestamp": timestamp,
                                        })), None)
                                    } else {
                                        eprintln!("[Rust] Message not found or handle is invalid");
                                        (false, None, Some("Message not found".to_string()))
                                    }
                                } else {
                                    (false, None, Some("Client not initialized".to_string()))
                                }
                            } else {
                                (false, None, Some("Could not lock client".to_string()))
                            }
                        }
                    } else {
                        (false, None, Some("Invalid message_id".to_string()))
                    }
                } else {
                    (false, None, Some("Missing message_id".to_string()))
                }
            } else {
                (false, None, Some("Missing args".to_string()))
            }
        }
        "get_user_messages" => {
            if let Some(args) = &req.args {
                if let Some(recipient_id_str) = args.get("recipient_id").and_then(|v| v.as_str()) {
                    if let Ok(recipient_id) = recipient_id_str.parse::<u64>() {
                        let initialized = INITIALIZED.lock().unwrap();
                        if !*initialized {
                            (false, None, Some("SDK not initialized".to_string()))
                        } else {
                            drop(initialized);
                            
                            let limit = args.get("limit")
                                .and_then(|v| v.as_i64())
                                .unwrap_or(50) as i32;
                            
                            eprintln!("[Rust] Getting user messages: recipient_id={}, limit={}", recipient_id, limit);
                            
                            struct UserMessageFetchData {
                                messages: Arc<Mutex<Vec<serde_json::Value>>>,
                                completed: Arc<Mutex<bool>>,
                            }
                            
                            let messages: Arc<Mutex<Vec<serde_json::Value>>> = Arc::new(Mutex::new(Vec::new()));
                            let completed: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
                            let messages_clone = Arc::clone(&messages);
                            let completed_clone = Arc::clone(&completed);
                            
                            extern "C" fn user_messages_callback(
                                _result: *mut DiscordClientResult,
                                span: DiscordMessageHandleSpan,
                                user_data: *mut c_void,
                            ) {
                                eprintln!("[Rust] 💬 GetUserMessages callback FIRED!");
                                
                                unsafe {
                                    let fetch_data_ptr = user_data as *mut UserMessageFetchData;
                                    let fetch_data = &*fetch_data_ptr;
                                    let mut msg_vec = fetch_data.messages.lock().unwrap();
                                    
                                    if span.ptr.is_null() || span.size == 0 {
                                        eprintln!("[Rust] No messages in response");
                                    } else {
                                        for i in 0..span.size {
                                            let handle = &mut *span.ptr.add(i);
                                            
                                            let msg_id = Discord_MessageHandle_Id(handle);
                                            let author_id = Discord_MessageHandle_AuthorId(handle);
                                            let timestamp = Discord_MessageHandle_SentTimestamp(handle);
                                            let channel_id = Discord_MessageHandle_ChannelId(handle);
                                            
                                            let mut content_str = DiscordString {
                                                ptr: std::ptr::null(),
                                                size: 0,
                                            };
                                            Discord_MessageHandle_Content(handle, &mut content_str);
                                            
                                            let content = if !content_str.ptr.is_null() && content_str.size > 0 {
                                                String::from_utf8_lossy(std::slice::from_raw_parts(content_str.ptr, content_str.size)).to_string()
                                            } else {
                                                "".to_string()
                                            };
                                            
                                            eprintln!("[Rust]   Message #{}: id={}, author={}, content={}", i, msg_id, author_id, &content[..std::cmp::min(50, content.len())]);
                                            
                                            msg_vec.push(serde_json::json!({
                                                "id": msg_id.to_string(),
                                                "author_id": author_id.to_string(),
                                                "channel_id": channel_id.to_string(),
                                                "content": content,
                                                "timestamp": timestamp,
                                            }));
                                            
                                            Discord_MessageHandle_Drop(handle);
                                        }
                                    }
                                    
                                    *fetch_data.completed.lock().unwrap() = true;
                                }
                            }
                            extern "C" fn user_message_free(ptr: *mut c_void) {
                                if !ptr.is_null() {
                                    unsafe { let _ = Box::from_raw(ptr as *mut UserMessageFetchData); }
                                }
                            }
                            
                            if let Ok(client_guard) = CLIENT_PTR.lock() {
                                if *client_guard != 0 {
                                    let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                                    
                                    let fetch_data = Box::new(UserMessageFetchData {
                                        messages: messages_clone,
                                        completed: completed_clone,
                                    });
                                    let user_data = Box::into_raw(fetch_data) as *mut c_void;
                                    
                                    unsafe {
                                        Discord_Client_GetUserMessagesWithLimit(
                                            client_ref,
                                            recipient_id,
                                            limit,
                                            user_messages_callback,
                                            user_message_free,
                                            user_data,
                                        );
                                    }
                                }
                            }
                            
                            let timeout = std::time::Instant::now();
                            while timeout.elapsed() < Duration::from_secs(10) {
                                unsafe {
                                    Discord_RunCallbacks();
                                }
                                if *completed.lock().unwrap() { break; }
                                thread::sleep(Duration::from_millis(50));
                            }
                            
                            if *completed.lock().unwrap() {
                                let fetched_messages = messages.lock().unwrap();
                                eprintln!("[Rust] Fetched {} messages", fetched_messages.len());
                                (true, Some(serde_json::json!({"messages": fetched_messages.clone()})), None)
                            } else {
                                (false, None, Some("Message fetch timeout".to_string()))
                            }
                        }
                    } else {
                        (false, None, Some("Invalid recipient_id".to_string()))
                    }
                } else {
                    (false, None, Some("Missing recipient_id".to_string()))
                }
            } else {
                (false, None, Some("Missing args".to_string()))
            }
        }
        "create_lobby" => {
            let secret = req.args.as_ref()
                .and_then(|a| a.get("secret"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let title = req.args.as_ref()
                .and_then(|a| a.get("title"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let description = req.args.as_ref()
                .and_then(|a| a.get("description"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else {
                drop(initialized);
                
                let secret_str = DiscordString {
                    ptr: secret.as_ptr(),
                    size: secret.len(),
                };
                
                let title_key = b"title";
                let desc_key = b"description";
                let mut keys = vec![
                    DiscordString { ptr: title_key.as_ptr(), size: title_key.len() },
                    DiscordString { ptr: desc_key.as_ptr(), size: desc_key.len() },
                ];
                let mut values = vec![
                    DiscordString { ptr: title.as_ptr(), size: title.len() },
                    DiscordString { ptr: description.as_ptr(), size: description.len() },
                ];
                
                let lobby_metadata = DiscordProperties {
                    size: 2,
                    keys: keys.as_mut_ptr(),
                    values: values.as_mut_ptr(),
                };
                
                let empty_metadata = DiscordProperties {
                    size: 0,
                    keys: std::ptr::null_mut(),
                    values: std::ptr::null_mut(),
                };
                
                let lobby_created = Arc::new(Mutex::new(false));
                let lobby_id_result = Arc::new(Mutex::new(0u64));
                let lobby_created_clone = Arc::clone(&lobby_created);
                let lobby_id_clone = Arc::clone(&lobby_id_result);
                
                struct LobbyData {
                    created: Arc<Mutex<bool>>,
                    lobby_id: Arc<Mutex<u64>>,
                }
                
                extern "C" fn lobby_callback(result: *mut DiscordClientResult, lobby_id: u64, user_data: *mut c_void) {
                    unsafe {
                        let data = &*(user_data as *const LobbyData);
                        if !result.is_null() {
                            eprintln!("[Rust] Lobby created: {}", lobby_id);
                            *data.lobby_id.lock().unwrap() = lobby_id;
                        } else {
                            eprintln!("[Rust] Lobby creation failed");
                        }
                        *data.created.lock().unwrap() = true;
                    }
                }
                
                extern "C" fn lobby_free(ptr: *mut c_void) {
                    if !ptr.is_null() {
                        unsafe { let _ = Box::from_raw(ptr as *mut LobbyData); }
                    }
                }
                
                let lobby_data = Box::new(LobbyData {
                    created: lobby_created_clone,
                    lobby_id: lobby_id_clone,
                });
                let user_data = Box::into_raw(lobby_data) as *mut c_void;
                
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        unsafe {
                            Discord_Client_CreateOrJoinLobbyWithMetadata(
                                client_ref,
                                secret_str,
                                lobby_metadata,
                                empty_metadata,
                                lobby_callback,
                                Some(lobby_free),
                                user_data,
                            );
                        }
                    }
                }
                
                let timeout = std::time::Instant::now();
                while timeout.elapsed() < Duration::from_secs(10) {
                    unsafe {
                        Discord_RunCallbacks();
                    }
                    if *lobby_created.lock().unwrap() { break; }
                    thread::sleep(Duration::from_millis(50));
                }
                
                if *lobby_created.lock().unwrap() {
                    let lobby_id = *lobby_id_result.lock().unwrap();
                    (true, Some(serde_json::json!({"lobby_id": lobby_id.to_string()})), None)
                } else {
                    (false, None, Some("Lobby creation timeout".to_string()))
                }
            }
        }
        "send_lobby_message" => {
            // Parse lobby_id from string to u64 (it's a Discord snowflake, too large for JSON numbers)
            let lobby_id = req.args.as_ref()
                .and_then(|a| a.get("lobby_id"))
                .and_then(|v| match v {
                    serde_json::Value::String(s) => s.parse::<u64>().ok(),
                    serde_json::Value::Number(n) => n.as_u64(),
                    _ => None
                })
                .unwrap_or(0);
            let content = req.args.as_ref()
                .and_then(|a| a.get("content"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else if lobby_id == 0 {
                (false, None, Some("Invalid lobby ID".to_string()))
            } else {
                drop(initialized);
                
                // CRITICAL: Allocate content string to keep it alive during async SDK call
                let content_owned = content.to_string();
                let content_bytes = content_owned.into_bytes();
                
                struct MessageData {
                    sent: Arc<Mutex<bool>>,
                    success: Arc<Mutex<bool>>,
                    _content: Vec<u8>,  // Keep content alive during SDK call
                }
                
                let msg_sent = Arc::new(Mutex::new(false));
                let msg_success = Arc::new(Mutex::new(false));
                let msg_sent_clone = Arc::clone(&msg_sent);
                let msg_success_clone = Arc::clone(&msg_success);
                
                extern "C" fn msg_callback(result: *mut DiscordClientResult, lobby_id: u64, user_data: *mut c_void) {
                    unsafe {
                        let data = &*(user_data as *const MessageData);
                        if result.is_null() {
                            eprintln!("[Rust] ❌ SendLobbyMessage callback returned NULL result for lobby {}", lobby_id);
                            *data.success.lock().unwrap() = false;
                        } else {
                            eprintln!("[Rust] ✅ SendLobbyMessage callback SUCCESS for lobby {}", lobby_id);
                            *data.success.lock().unwrap() = true;
                        }
                        *data.sent.lock().unwrap() = true;
                    }
                }
                
                extern "C" fn msg_free(ptr: *mut c_void) {
                    if !ptr.is_null() {
                        unsafe { let _ = Box::from_raw(ptr as *mut MessageData); }
                    }
                }
                
                let message_data = Box::new(MessageData {
                    sent: msg_sent_clone,
                    success: msg_success_clone,
                    _content: content_bytes.clone(),
                });
                let user_data = Box::into_raw(message_data) as *mut c_void;
                
                let content_str = DiscordString {
                    ptr: content_bytes.as_ptr(),
                    size: content_bytes.len(),
                };
                
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        unsafe {
                            Discord_Client_SendLobbyMessage(client_ref, lobby_id, content_str, msg_callback, msg_free, user_data);
                        }
                    }
                }
                
                let timeout = std::time::Instant::now();
                while timeout.elapsed() < Duration::from_secs(15) {
                    unsafe {
                        Discord_RunCallbacks();
                    }
                    if *msg_sent.lock().unwrap() { break; }
                    thread::sleep(Duration::from_millis(25));
                }
                
                let was_sent = *msg_sent.lock().unwrap();
                let was_successful = *msg_success.lock().unwrap();
                
                if !was_sent {
                    (false, None, Some("Send message timeout - callback never fired".to_string()))
                } else if !was_successful {
                    (false, None, Some("Discord SDK returned error result for SendLobbyMessage".to_string()))
                } else {
                    eprintln!("[Rust] ✅ Lobby message successfully sent to {}", lobby_id);
                    
                    // Additional polling to ensure Discord processes the message
                    eprintln!("[Rust] Polling Discord to ensure message is processed...");
                    let sync_timeout = std::time::Instant::now();
                    while sync_timeout.elapsed() < Duration::from_secs(5) {
                        unsafe {
                            Discord_RunCallbacks();
                        }
                        thread::sleep(Duration::from_millis(25));
                    }
                    
                    (true, Some(serde_json::json!({"sent": true})), None)
                }
            }
        }
        "leave_lobby" => {
            let lobby_id = req.args.as_ref()
                .and_then(|a| a.get("lobby_id"))
                .and_then(|v| {
                    // Handle both number and string formats
                    if let Some(n) = v.as_u64() {
                        Some(n)
                    } else if let Some(s) = v.as_str() {
                        s.parse::<u64>().ok()
                    } else {
                        None
                    }
                })
                .unwrap_or(0);
            
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else if lobby_id == 0 {
                (false, None, Some("Invalid lobby ID".to_string()))
            } else {
                drop(initialized);
                
                let leave_done = Arc::new(Mutex::new(false));
                let leave_done_clone = Arc::clone(&leave_done);
                
                extern "C" fn leave_callback(_result: *mut DiscordClientResult, user_data: *mut c_void) {
                    unsafe {
                        let flag = &*(user_data as *const Arc<Mutex<bool>>);
                        *flag.lock().unwrap() = true;
                    }
                }
                
                extern "C" fn leave_free(ptr: *mut c_void) {
                    if !ptr.is_null() {
                        unsafe { let _ = Box::from_raw(ptr as *mut Arc<Mutex<bool>>); }
                    }
                }
                
                let user_data = Box::into_raw(Box::new(leave_done_clone)) as *mut c_void;
                
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        unsafe {
                            Discord_Client_LeaveLobby(client_ref, lobby_id, leave_callback, leave_free, user_data);
                        }
                    }
                }
                
                let timeout = std::time::Instant::now();
                while timeout.elapsed() < Duration::from_secs(5) {
                    unsafe {
                        Discord_RunCallbacks();
                    }
                    if *leave_done.lock().unwrap() { break; }
                    thread::sleep(Duration::from_millis(50));
                }
                
                if *leave_done.lock().unwrap() {
                    eprintln!("[Rust] Left lobby {}", lobby_id);
                    (true, Some(serde_json::json!({"left": true})), None)
                } else {
                    (false, None, Some("Leave lobby timeout".to_string()))
                }
            }
        }
        "set_mute" => {
            let mute = req.args.as_ref()
                .and_then(|a| a.get("mute"))
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else {
                drop(initialized);
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        unsafe {
                            Discord_Client_SetSelfMuteAll(client_ref, mute);
                            Discord_RunCallbacks();
                        }
                    }
                }
                eprintln!("[Rust] Set mute to: {}", mute);
                (true, Some(serde_json::json!({"muted": mute})), None)
            }
        }
        "set_deaf" => {
            let deaf = req.args.as_ref()
                .and_then(|a| a.get("deaf"))
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else {
                drop(initialized);
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        unsafe {
                            Discord_Client_SetSelfDeafAll(client_ref, deaf);
                            Discord_RunCallbacks();
                        }
                    }
                }
                eprintln!("[Rust] Set deaf to: {}", deaf);
                (true, Some(serde_json::json!({"deafened": deaf})), None)
            }
        }
        "get_mute_status" => {
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else {
                drop(initialized);
                let mut muted = false;
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        muted = unsafe { Discord_Client_GetSelfMuteAll(client_ref) };
                        unsafe { Discord_RunCallbacks(); }
                    }
                }
                (true, Some(serde_json::json!({"muted": muted})), None)
            }
        }
        "get_deaf_status" => {
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else {
                drop(initialized);
                let mut deafened = false;
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        deafened = unsafe { Discord_Client_GetSelfDeafAll(client_ref) };
                        unsafe { Discord_RunCallbacks(); }
                    }
                }
                (true, Some(serde_json::json!({"deafened": deafened})), None)
            }
        }
        "connect_lobby_voice" => {
            if let Some(args) = &req.args {
                if let Some(lobby_id_str) = args.get("lobby_id").and_then(|v| v.as_str()) {
                    if let Ok(lobby_id) = lobby_id_str.parse::<u64>() {
                        let initialized = INITIALIZED.lock().unwrap();
                        if !*initialized {
                            eprintln!("[Rust] ❌ Voice: SDK not initialized");
                            (false, None, Some("SDK not initialized".to_string()))
                        } else {
                            drop(initialized);
                            
                            eprintln!("[Rust] 🎤 Connecting to lobby voice: lobby_id={}", lobby_id);
                            
                            let voice_connected = Arc::new(Mutex::new(false));
                            let voice_connected_clone = Arc::clone(&voice_connected);
                            let user_data = Box::into_raw(Box::new(voice_connected_clone)) as *mut c_void;
                            
                            if let Ok(client_guard) = CLIENT_PTR.lock() {
                                if *client_guard != 0 {
                                    let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                                    eprintln!("[Rust] 🎤 Calling Discord_Client_StartCall()...");
                                    unsafe {
                                        Discord_Client_StartCall(client_ref, lobby_id, user_data);
                                    }
                                    eprintln!("[Rust] 🎤 StartCall invoked, waiting for response...");
                                } else {
                                    eprintln!("[Rust] ❌ Voice: Client pointer is null");
                                    return Response {
                                        id: req.id,
                                        success: false,
                                        result: None,
                                        error: Some("Client not initialized".to_string()),
                                    };
                                }
                            }
                            
                            let timeout = std::time::Instant::now();
                            let mut callback_fired = false;
                            while timeout.elapsed() < Duration::from_secs(10) {
                                unsafe { Discord_RunCallbacks(); }
                                if *voice_connected.lock().unwrap() {
                                    callback_fired = true;
                                    eprintln!("[Rust] 🎤 ✅ Voice callback FIRED! Exiting wait loop.");
                                    break;
                                }
                                thread::sleep(Duration::from_millis(100));
                            }
                            
                            let success = *voice_connected.lock().unwrap();
                            eprintln!("[Rust] 🎤 Voice connect result: success={}, callback_fired={}", success, callback_fired);
                            
                            if !success {
                                eprintln!("[Rust] ❌ Voice connect FAILED - no callback received in 10 seconds");
                                eprintln!("[Rust]    Possible causes:");
                                eprintln!("[Rust]    - Discord app not running");
                                eprintln!("[Rust]    - Not in a lobby (must join lobby first)");
                                eprintln!("[Rust]    - Voice SDK not available on this platform/Discord build");
                                eprintln!("[Rust]    - Timeout waiting for Discord voice init");
                            }
                            
                            (true, Some(serde_json::json!({"connected": success, "callback_fired": callback_fired})), None)
                        }
                    } else {
                        eprintln!("[Rust] ❌ Voice: Invalid lobby ID format");
                        (false, None, Some("Invalid lobby ID".to_string()))
                    }
                } else {
                    eprintln!("[Rust] ❌ Voice: Missing lobby_id argument");
                    (false, None, Some("Missing lobby_id argument".to_string()))
                }
            } else {
                eprintln!("[Rust] ❌ Voice: Missing arguments");
                (false, None, Some("Missing arguments".to_string()))
            }
        }
        "disconnect_lobby_voice" => {
            if let Some(args) = &req.args {
                if let Some(lobby_id_str) = args.get("lobby_id").and_then(|v| v.as_str()) {
                    if let Ok(lobby_id) = lobby_id_str.parse::<u64>() {
                        let initialized = INITIALIZED.lock().unwrap();
                        if !*initialized {
                            (false, None, Some("SDK not initialized".to_string()))
                        } else {
                            drop(initialized);
                            
                            eprintln!("[Rust] Disconnecting from lobby voice: lobby_id={}", lobby_id);
                            
                            let voice_disconnected = Arc::new(Mutex::new(false));
                            let voice_disconnected_clone = Arc::clone(&voice_disconnected);
                            
                            extern "C" fn voice_disconnect_callback(result: *mut DiscordClientResult, user_data: *mut c_void) {
                                unsafe {
                                    let disconnected_ptr = user_data as *mut Arc<Mutex<bool>>;
                                    if !disconnected_ptr.is_null() {
                                        let disconnected = &*disconnected_ptr;
                                        if result.is_null() {
                                            eprintln!("[Rust] ❌ Voice disconnect failed: NULL result");
                                            *disconnected.lock().unwrap() = false;
                                        } else {
                                            eprintln!("[Rust] ✅ Voice disconnected successfully");
                                            *disconnected.lock().unwrap() = true;
                                        }
                                    }
                                }
                            }
                            
                            extern "C" fn voice_disconnect_free(ptr: *mut c_void) {
                                if !ptr.is_null() {
                                    unsafe { let _ = Box::from_raw(ptr as *mut Arc<Mutex<bool>>); }
                                }
                            }
                            
                            let user_data = Box::into_raw(Box::new(voice_disconnected_clone)) as *mut c_void;
                            
                            if let Ok(client_guard) = CLIENT_PTR.lock() {
                                if *client_guard != 0 {
                                    let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                                    unsafe {
                                        Discord_Client_EndCall(client_ref, lobby_id, voice_disconnect_callback, voice_disconnect_free, user_data);
                                    }
                                }
                            }
                            
                            let timeout = std::time::Instant::now();
                            while timeout.elapsed() < Duration::from_secs(10) {
                                unsafe { Discord_RunCallbacks(); }
                                thread::sleep(Duration::from_millis(25));
                            }
                            
                            (true, Some(serde_json::json!({"disconnected": true})), None)
                        }
                    } else {
                        (false, None, Some("Invalid lobby ID".to_string()))
                    }
                } else {
                    (false, None, Some("Missing lobby_id argument".to_string()))
                }
            } else {
                (false, None, Some("Missing arguments".to_string()))
            }
        }
        "get_message_events" => {
            // Retrieve and clear pending message events (silent polling)
            let mut events = Vec::new();
            if let Ok(mut msg_events) = MESSAGE_EVENTS.lock() {
                events = msg_events.drain(..).collect();
            }
            
            if events.is_empty() {
                (true, Some(serde_json::json!({"messages": []})), None)
            } else {
                let message_data: Vec<serde_json::Value> = events.iter()
                    .map(|(msg_id, timestamp)| {
                        serde_json::json!({
                            "message_id": msg_id.to_string(),
                            "timestamp": timestamp
                        })
                    })
                    .collect();
                (true, Some(serde_json::json!({"messages": message_data})), None)
            }
        }
        "create_or_join_lobby" => {
            let secret = req.args.as_ref()
                .and_then(|a| a.get("secret"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            
            let initialized = INITIALIZED.lock().unwrap();
            if !*initialized {
                (false, None, Some("SDK not initialized".to_string()))
            } else if secret.is_empty() {
                (false, None, Some("Lobby secret required".to_string()))
            } else {
                drop(initialized);
                
                let lobby_id = Arc::new(Mutex::new(0u64));
                let completed = Arc::new(Mutex::new(false));
                let lobby_id_clone = Arc::clone(&lobby_id);
                let completed_clone = Arc::clone(&completed);
                
                extern "C" fn lobby_callback(_result: *mut DiscordClientResult, lobby_id_val: u64, user_data: *mut c_void) {
                    unsafe {
                        let data = &*(user_data as *const (Arc<Mutex<u64>>, Arc<Mutex<bool>>));
                        *data.0.lock().unwrap() = lobby_id_val;
                        *data.1.lock().unwrap() = true;
                    }
                }
                
                extern "C" fn lobby_free(ptr: *mut c_void) {
                    if !ptr.is_null() {
                        unsafe { let _ = Box::from_raw(ptr as *mut (Arc<Mutex<u64>>, Arc<Mutex<bool>>)); }
                    }
                }
                
                let user_data = Box::into_raw(Box::new((lobby_id_clone, completed_clone))) as *mut c_void;
                let secret_str = DiscordString {
                    ptr: secret.as_ptr(),
                    size: secret.len(),
                };
                
                let lobby_metadata = DiscordProperties {
                    size: 0,
                    keys: std::ptr::null_mut(),
                    values: std::ptr::null_mut(),
                };
                
                let member_metadata = DiscordProperties {
                    size: 0,
                    keys: std::ptr::null_mut(),
                    values: std::ptr::null_mut(),
                };
                
                eprintln!("[Rust] Creating or joining lobby with secret: {}", secret);
                if let Ok(client_guard) = CLIENT_PTR.lock() {
                    if *client_guard != 0 {
                        let client_ref = unsafe { &mut *(*client_guard as *mut DiscordClient) };
                        unsafe {
                            Discord_Client_CreateOrJoinLobbyWithMetadata(client_ref, secret_str, lobby_metadata, member_metadata, lobby_callback, Some(lobby_free), user_data);
                        }
                    }
                }
                
                let timeout = std::time::Instant::now();
                while timeout.elapsed() < Duration::from_secs(10) {
                    unsafe {
                        Discord_RunCallbacks();
                    }
                    if *completed.lock().unwrap() { break; }
                    thread::sleep(Duration::from_millis(50));
                }
                
                let lobby_id_result = *lobby_id.lock().unwrap();
                let is_completed = *completed.lock().unwrap();
                
                if is_completed && lobby_id_result > 0 {
                    eprintln!("[Rust] ✅ Lobby created/joined with ID: {}", lobby_id_result);
                    (true, Some(serde_json::json!({"lobby_id": lobby_id_result.to_string()})), None)
                } else if is_completed {
                    (false, None, Some("Failed to create/join lobby".to_string()))
                } else {
                    (false, None, Some("Lobby operation timeout".to_string()))
                }
            }
        }
        "ping" => (true, Some(serde_json::json!({"pong": true})), None),
        _ => (false, None, Some(format!("Unknown: {}", req.command))),
    };
    Response {
        id: req.id,
        success,
        result,
        error,
    }
}

fn init_discord_sdk(token: &str, app_id: u64) -> Result<String, String> {
    unsafe {
        // CRITICAL: Tell SDK we're in a multi-threaded environment (Node.js subprocess)
        eprintln!("[Rust] Calling Discord_SetFreeThreaded (multi-threaded environment)");
        Discord_SetFreeThreaded();
        
        let mut client = Box::new(DiscordClient {
            opaque: std::ptr::null_mut(),
        });

        eprintln!("[Rust] Calling Discord_Client_Init");
        Discord_Client_Init(client.as_mut());

        if app_id != 0 {
            eprintln!("[Rust] Setting application ID: {}", app_id);
            Discord_Client_SetApplicationId(client.as_mut(), app_id);
        } else {
            eprintln!("[Rust] WARNING: No application ID provided");
            return Err("No application ID provided".to_string());
        }
        
        // Store app ID for use in status callbacks
        if let Ok(mut app_id_guard) = CURRENT_APP_ID.lock() {
            *app_id_guard = app_id;
        }

        // Set up status change callback
        extern "C" fn status_callback(status: c_int, error: c_int, error_detail: c_int, _user_data: *mut c_void) {
            if error != 0 {
                let app_id = CURRENT_APP_ID.lock().unwrap();
                eprintln!("[Rust] ❌ STATUS CALLBACK ERROR: status={} error={} detail={}", status, error, error_detail);
                eprintln!("[Rust]    ERROR 4004 = 'Unknown Application' - Discord app rejected the SDK connection");
                eprintln!("[Rust]    Application ID: {}", *app_id);
                eprintln!("[Rust]    Possible causes:");
                eprintln!("[Rust]      1. App ID not configured for SDK in Discord Developer Portal");
                eprintln!("[Rust]      2. 'Public Client' toggle not enabled for this app");
                eprintln!("[Rust]      3. Discord app version incompatible with SDK");
                eprintln!("[Rust]      4. SDK authentication not whitelisted by Discord");
            } else {
                eprintln!("[Rust] 🔔 STATUS CALLBACK: status={}", status);
            }
            if let Ok(mut current_status) = CURRENT_STATUS.lock() {
                *current_status = status;
            }
        }
        extern "C" fn status_free(_ptr: *mut c_void) {}
        
        Discord_Client_SetStatusChangedCallback(client.as_mut(), status_callback, status_free, std::ptr::null_mut());

        // Check if we have a stored token (not SDK_AUTH_REQUIRED marker)
        if token != "SDK_AUTH_REQUIRED" && token.len() > 20 {
            eprintln!("[Rust] Using stored token, skipping authorization flow");
            
            // Parse token format: "type=1:accesstoken..." or just "accesstoken..." (legacy)
            let (stored_token_type, actual_token) = if token.starts_with("type=") {
                if let Some(colon_idx) = token.find(':') {
                    let type_str = &token[5..colon_idx]; // Extract "1" from "type=1:"
                    let parsed_type: c_int = type_str.parse().unwrap_or(1);
                    let token_str = &token[colon_idx+1..];
                    (parsed_type, token_str.to_string())
                } else {
                    // Malformed, default to Bearer
                    (1, token.to_string())
                }
            } else {
                // Legacy format without type, assume Bearer (1)
                (1, token.to_string())
            };
            
            eprintln!("[Rust] Stored token format: type={}, token_len={}", stored_token_type, actual_token.len());
            
            let token_cstr = CString::new(actual_token).map_err(|_| "Invalid token string")?;
            let discord_token = DiscordString {
                ptr: token_cstr.as_ptr() as *const u8,
                size: token_cstr.as_bytes().len(),
            };
            
            // Use proper callbacks (Rust FFI cannot safely use NULL function pointers via transmute)
            let token_updated = Arc::new(Mutex::new(false));
            let token_updated_for_callback = Arc::clone(&token_updated);
            
            extern "C" fn token_callback(_result: *mut DiscordClientResult, user_data: *mut c_void) {
                eprintln!("[Rust] ✅ UpdateToken callback fired (stored token path)");
                unsafe {
                    let flag = &*(user_data as *const Arc<Mutex<bool>>);
                    *flag.lock().unwrap() = true;
                }
            }
            extern "C" fn token_free(ptr: *mut c_void) {
                if !ptr.is_null() {
                    unsafe { let _ = Box::from_raw(ptr as *mut Arc<Mutex<bool>>); }
                }
            }
            
            let user_data = Box::into_raw(Box::new(token_updated_for_callback)) as *mut c_void;
            
            eprintln!("[Rust] Calling UpdateToken with stored token (type={}, using proper callbacks)", stored_token_type);
            Discord_Client_UpdateToken(client.as_mut(), stored_token_type, discord_token, token_callback, token_free, user_data);
            
            // Wait for callback to fire
            let wait_start = std::time::Instant::now();
            while wait_start.elapsed() < Duration::from_secs(5) {
                Discord_RunCallbacks();
                if *token_updated.lock().unwrap() { break; }
                thread::sleep(Duration::from_millis(50));
            }
            
            if !*token_updated.lock().unwrap() {
                eprintln!("[Rust] ⚠️  UpdateToken callback did not fire within timeout");
            }
            
            // Validate token before Connect
            eprintln!("[Rust] Token validation (stored token path):");
            eprintln!("[Rust]   Type: Bearer");
            eprintln!("[Rust]   Length: {}", token.len());
            if token.is_empty() {
                return Err("Token is empty".to_string());
            }
            if token.len() < 20 {
                return Err("Token appears malformed (too short)".to_string());
            }
            eprintln!("[Rust]   Status: ✅ Valid");
            
            // Call Connect after token is confirmed set
            eprintln!("[Rust] Calling Connect after UpdateToken callback");
            Discord_Client_Connect(client.as_mut());
            eprintln!("[Rust] Connect call completed");
            
            *TOKEN.lock().unwrap() = Some(token_cstr);
            
            let client_ptr: usize = Box::into_raw(client) as usize;
            *CLIENT_PTR.lock().unwrap() = client_ptr;
            
            // Register message created callback for real-time message events
            extern "C" fn on_message_created(message_id: u64, _user_data: *mut c_void) {
                eprintln!("[Rust] 💬 MESSAGE_CREATED EVENT: message_id={}", message_id);
                if let Ok(mut events) = MESSAGE_EVENTS.lock() {
                    let timestamp = format!("{:?}", std::time::SystemTime::now());
                    events.push((message_id, timestamp));
                }
            }
            extern "C" fn message_free(_ptr: *mut c_void) {}
            
            let client_guard = CLIENT_PTR.lock().unwrap();
            if *client_guard != 0 {
                let client_ref = &mut *(*client_guard as *mut DiscordClient);
                Discord_Client_SetMessageCreatedCallback(
                    client_ref,
                    on_message_created,
                    message_free,
                    std::ptr::null_mut(),
                );
                eprintln!("[Rust] ✅ Message created callback registered");
            }
            drop(client_guard);
            
            eprintln!("[Rust] Waiting for SDK to reach Ready status (need status >= 3)...");
            eprintln!("[Rust] Status meanings: 0=Uninitialized, 1=Connecting, 2=Connected, 3=Ready");
            eprintln!("[Rust] If stuck at status=1, Discord app may not be running or accessible");
            
            let connect_wait = std::time::Instant::now();
            let mut last_status = 0;
            let mut error_4004_seen = false;
            
            while connect_wait.elapsed() < Duration::from_secs(30) {
                Discord_RunCallbacks();
                let status = *CURRENT_STATUS.lock().unwrap();
                
                // Only log if status changed
                if status != last_status {
                    eprintln!("[Rust] Status changed to: {}", status);
                    last_status = status;
                }
                
                if status >= 3 {
                    eprintln!("[Rust] ✅ SDK reached Ready status: {}", status);
                    *INITIALIZED.lock().unwrap() = true;
                    return Ok("initialized".to_string());
                }
                
                // If we see status 0 right after status 2, that's error 4004
                // But keep retrying - sometimes it recovers
                if status == 0 && last_status == 2 {
                    if !error_4004_seen {
                        error_4004_seen = true;
                        eprintln!("[Rust] ⚠️  Got error 4004 (status went 2→0), but continuing to retry...");
                    }
                }
                
                thread::sleep(Duration::from_millis(200));
            }
            
            if error_4004_seen {
                eprintln!("[Rust] ❌ SDK failed with error 4004 - Discord app not configured for SDK access");
                return Err("SDK error 4004 - app not configured for SDK in Developer Portal".to_string());
            }
            
            let final_status = *CURRENT_STATUS.lock().unwrap();
            return Err(format!("SDK connection timeout - stuck at status={}", final_status));
        }

        eprintln!("[Rust] No stored token, starting full authorization flow");
        // STEP 1: Authorize with Discord app to get authorization CODE
        struct AuthData {
            done: Arc<Mutex<bool>>,
            code: Arc<Mutex<Option<String>>>,
            redirect: Arc<Mutex<Option<String>>>,
        }
        
        let auth_data = Arc::new(AuthData {
            done: Arc::new(Mutex::new(false)),
            code: Arc::new(Mutex::new(None)),
            redirect: Arc::new(Mutex::new(None)),
        });
        let auth_data_clone = Arc::clone(&auth_data);
        
        extern "C" fn auth_callback(result: *mut DiscordClientResult, code: DiscordString, redirect: DiscordString, user_data: *mut c_void) {
            eprintln!("[Rust] ✅ Authorize callback FIRED");
            eprintln!("[Rust]   result ptr: {:?}", result);
            eprintln!("[Rust]   code.ptr: {:?}, code.size: {}", code.ptr, code.size);
            eprintln!("[Rust]   redirect.ptr: {:?}, redirect.size: {}", redirect.ptr, redirect.size);
            
            // Check if authorization was successful
            unsafe {
                if !Discord_ClientResult_Successful(result) {
                    eprintln!("[Rust] ❌ Authorize FAILED - Discord returned error!");
                    let error_code = Discord_ClientResult_ErrorCode(result);
                    let mut error_str = DiscordString { ptr: std::ptr::null(), size: 0 };
                    Discord_ClientResult_Error(result, &mut error_str);
                    if !error_str.ptr.is_null() && error_str.size > 0 {
                        let error_msg = String::from_utf8_lossy(std::slice::from_raw_parts(error_str.ptr, error_str.size));
                        eprintln!("[Rust] Error code: {}, Message: {}", error_code, error_msg);
                    } else {
                        eprintln!("[Rust] Error code: {} (no message)", error_code);
                    }
                    let data = &*(user_data as *const Arc<AuthData>);
                    *data.done.lock().unwrap() = true;
                    return;
                }
            }
            
            unsafe {
                let data = &*(user_data as *const Arc<AuthData>);
                if !code.ptr.is_null() && code.size > 0 {
                    let code_str = String::from_utf8_lossy(std::slice::from_raw_parts(code.ptr, code.size)).to_string();
                    eprintln!("[Rust] ✅ Authorization code: {} (len={})", code_str, code_str.len());
                    *data.code.lock().unwrap() = Some(code_str);
                } else {
                    eprintln!("[Rust] ❌ Authorization code is NULL or empty!");
                    eprintln!("[Rust] ❌ Possible reasons:");
                    eprintln!("[Rust]    1. User clicked CANCEL button in Discord popup");
                    eprintln!("[Rust]    2. Redirect URI not registered in Discord Developer Portal");
                    eprintln!("[Rust]    3. PKCE challenge mismatch");
                    eprintln!("[Rust]    4. Application ID mismatch");
                }
                if !redirect.ptr.is_null() && redirect.size > 0 {
                    let redirect_str = String::from_utf8_lossy(std::slice::from_raw_parts(redirect.ptr, redirect.size)).to_string();
                    eprintln!("[Rust] Redirect URI: {}", redirect_str);
                    *data.redirect.lock().unwrap() = Some(redirect_str);
                } else {
                    eprintln!("[Rust] ❌ Redirect URI is NULL or empty!");
                }
                *data.done.lock().unwrap() = true;
            }
        }
        extern "C" fn auth_free(ptr: *mut c_void) {
            if !ptr.is_null() {
                unsafe { let _ = Box::from_raw(ptr as *mut Arc<AuthData>); }
            }
        }
        
        // Create code verifier for PKCE flow
        let mut code_verifier = Box::new(DiscordAuthorizationCodeVerifier { opaque: std::ptr::null_mut() });
        Discord_Client_CreateAuthorizationCodeVerifier(client.as_mut(), code_verifier.as_mut());
        
        // Get challenge from verifier
        let mut challenge_struct = Box::new(DiscordAuthorizationCodeChallenge { opaque: std::ptr::null_mut() });
        Discord_AuthorizationCodeVerifier_Challenge(code_verifier.as_mut(), challenge_struct.as_mut());
        
        // Get challenge string from challenge struct
        let mut challenge_ds = DiscordString { ptr: std::ptr::null(), size: 0 };
        Discord_AuthorizationCodeChallenge_Challenge(challenge_struct.as_mut(), &mut challenge_ds);
        
        let mut auth_args = Box::new(DiscordAuthorizationArgs { opaque: std::ptr::null_mut() });
        Discord_AuthorizationArgs_Init(auth_args.as_mut());
        Discord_AuthorizationArgs_SetClientId(auth_args.as_mut(), app_id);
        
        // Using v2's proven working scopes: spaces separator, openid required
        let scopes_str = b"openid sdk.social_layer identify email guilds connections";
        let scopes = DiscordString {
            ptr: scopes_str.as_ptr() as *mut u8,
            size: scopes_str.len(),
        };
        eprintln!("[Rust] Requesting scopes: openid sdk.social_layer identify email guilds connections");
        Discord_AuthorizationArgs_SetScopes(auth_args.as_mut(), scopes);
        Discord_AuthorizationArgs_SetCodeChallenge(auth_args.as_mut(), challenge_struct.as_mut());
        
        let auth_user_data = Box::into_raw(Box::new(auth_data_clone)) as *mut c_void;
        
        eprintln!("[Rust] Calling Authorize to get authorization code");
        Discord_Client_Authorize(client.as_mut(), auth_args.as_mut(), auth_callback, auth_free, auth_user_data);
        
        // Wait for authorization
        let auth_wait = std::time::Instant::now();
        while auth_wait.elapsed() < Duration::from_secs(30) {
            Discord_RunCallbacks();
            if *auth_data.done.lock().unwrap() { break; }
            thread::sleep(Duration::from_millis(100));
        }
        
        if !*auth_data.done.lock().unwrap() {
            return Err("Authorization timeout".to_string());
        }
        
        let auth_code = auth_data.code.lock().unwrap().clone().ok_or("No authorization code received")?;
        let redirect_uri = auth_data.redirect.lock().unwrap().clone().unwrap_or_else(|| "http://127.0.0.1/callback".to_string());
        
        // Get verifier string
        let mut verifier_ds = DiscordString { ptr: std::ptr::null(), size: 0 };
        Discord_AuthorizationCodeVerifier_Verifier(code_verifier.as_mut(), &mut verifier_ds);
        eprintln!("[Rust] Got verifier string");
        
        eprintln!("[Rust] Got authorization code, exchanging for token with verifier");
        
        // Give Discord SDK time to settle after Authorize before calling GetToken
        // The SDK needs to be ready with an active connection before token exchange
        let stabilize_start = std::time::Instant::now();
        let mut sdk_ready = false;
        while stabilize_start.elapsed() < Duration::from_secs(8) {
            Discord_RunCallbacks();
            let current_status = *CURRENT_STATUS.lock().unwrap();
            eprintln!("[Rust] SDK status: {} (waiting for >= 2 which is READY)", current_status);
            if current_status >= 2 {
                sdk_ready = true;
                eprintln!("[Rust] ✅ SDK is READY (status={}), proceeding with GetToken", current_status);
                break;
            }
            thread::sleep(Duration::from_millis(500));
        }
        
        if !sdk_ready {
            eprintln!("[Rust] ⚠️ WARNING: SDK still not ready before GetToken!");
            eprintln!("[Rust] Discord may not be fully initialized or IPC connection unstable");
        }
        
        // STEP 2: Exchange authorization code for access token using GetToken
        struct TokenData {
            done: Arc<Mutex<bool>>,
            access_token: Arc<Mutex<Option<String>>>,
            refresh_token: Arc<Mutex<Option<String>>>,
            expires_in: Arc<Mutex<Option<i32>>>,
            token_type: Arc<Mutex<Option<c_int>>>,
        }
        
        let token_data = Arc::new(TokenData {
            done: Arc::new(Mutex::new(false)),
            access_token: Arc::new(Mutex::new(None)),
            refresh_token: Arc::new(Mutex::new(None)),
            expires_in: Arc::new(Mutex::new(None)),
            token_type: Arc::new(Mutex::new(None)),
        });
        let token_data_clone = Arc::clone(&token_data);
        
        extern "C" fn get_token_callback(_result: *mut DiscordClientResult, access_token: DiscordString, refresh_token: DiscordString, token_type: c_int, expires_in: c_int, _scope: DiscordString, user_data: *mut c_void) {
            eprintln!("[Rust] 🔥 GetToken callback FIRED!");
            
            // Check if GetToken was successful
            unsafe {
                if !Discord_ClientResult_Successful(_result) {
                    eprintln!("[Rust] ❌ GetToken FAILED - Discord returned error!");
                    let error_code = Discord_ClientResult_ErrorCode(_result);
                    let mut error_str = DiscordString { ptr: std::ptr::null(), size: 0 };
                    Discord_ClientResult_Error(_result, &mut error_str);
                    if !error_str.ptr.is_null() && error_str.size > 0 {
                        let error_msg = String::from_utf8_lossy(std::slice::from_raw_parts(error_str.ptr, error_str.size));
                        eprintln!("[Rust] Error code: {}, Message: {}", error_code, error_msg);
                    } else {
                        eprintln!("[Rust] Error code: {} (no message)", error_code);
                    }
                    let data = &*(user_data as *const Arc<TokenData>);
                    *data.done.lock().unwrap() = true;
                    return;
                }
            }
            
            unsafe {
                let data = &*(user_data as *const Arc<TokenData>);
                if !access_token.ptr.is_null() && access_token.size > 0 {
                    let token_str = String::from_utf8_lossy(std::slice::from_raw_parts(access_token.ptr, access_token.size)).to_string();
                    eprintln!("[Rust] ✅ Got access token (len={})", token_str.len());
                    *data.access_token.lock().unwrap() = Some(token_str);
                } else {
                    eprintln!("[Rust] ❌ GetToken FAILED: access_token is NULL!");
                    eprintln!("[Rust] Discord IPC may have failed or code is invalid");
                }
                
                // Capture refresh token for long-term storage
                if !refresh_token.ptr.is_null() && refresh_token.size > 0 {
                    let refresh_str = String::from_utf8_lossy(std::slice::from_raw_parts(refresh_token.ptr, refresh_token.size)).to_string();
                    eprintln!("[Rust] ✅ Got refresh token (len={})", refresh_str.len());
                    *data.refresh_token.lock().unwrap() = Some(refresh_str);
                } else {
                    eprintln!("[Rust] ⚠️  Refresh token is NULL - won't be able to auto-refresh");
                }
                
                // Capture expiration time
                *data.expires_in.lock().unwrap() = Some(expires_in);
                eprintln!("[Rust] ✅ Token expires in: {} seconds", expires_in);
                
                // Capture token type from Discord
                *data.token_type.lock().unwrap() = Some(token_type);
                eprintln!("[Rust] ✅ Token type from Discord: {} (1=Bearer)", token_type);
                
                *data.done.lock().unwrap() = true;
            }
        }
        extern "C" fn get_token_free(ptr: *mut c_void) {
            if !ptr.is_null() {
                unsafe { let _ = Box::from_raw(ptr as *mut Arc<TokenData>); }
            }
        }
        
        let code_cstr = CString::new(auth_code.clone()).unwrap();
        let redirect_cstr = CString::new(redirect_uri.clone()).unwrap();
        
        let code_ds = DiscordString { ptr: code_cstr.as_ptr() as *const u8, size: code_cstr.as_bytes().len() };
        let redirect_ds = DiscordString { ptr: redirect_cstr.as_ptr() as *const u8, size: redirect_cstr.as_bytes().len() };
        
        eprintln!("[Rust] GetToken parameters:");
        eprintln!("[Rust]   app_id: {}", app_id);
        eprintln!("[Rust]   code: {} (len={})", auth_code, auth_code.len());
        eprintln!("[Rust]   redirect_uri: {}", redirect_uri);
        eprintln!("[Rust]   verifier: present={}", !verifier_ds.ptr.is_null());
        
        let token_user_data = Box::into_raw(Box::new(token_data_clone)) as *mut c_void;
        
        eprintln!("[Rust] Calling GetToken...");
        Discord_Client_GetToken(client.as_mut(), app_id, code_ds, verifier_ds, redirect_ds, get_token_callback, get_token_free, token_user_data);
        
        // Wait for token exchange - MUST keep CStrings alive during async operation!
        let token_wait = std::time::Instant::now();
        let mut last_log = std::time::Instant::now();
        loop {
            Discord_RunCallbacks();
            if *token_data.done.lock().unwrap() {
                eprintln!("[Rust] GetToken completed after {:.2}s", token_wait.elapsed().as_secs_f64());
                break;
            }
            if token_wait.elapsed() > Duration::from_secs(30) {
                eprintln!("[Rust] GetToken TIMEOUT after 30s - callback never completed!");
                break;
            }
            if last_log.elapsed() > Duration::from_secs(2) {
                eprintln!("[Rust] Still waiting for GetToken... ({:.1}s elapsed)", token_wait.elapsed().as_secs_f64());
                last_log = std::time::Instant::now();
            }
            thread::sleep(Duration::from_millis(50));
        }
        // Keep CStrings in scope - they're now dropped after the wait loop, not before
        
        if !*token_data.done.lock().unwrap() {
            eprintln!("[Rust] GetToken TIMEOUT after {:.2}s - callback never fired!", token_wait.elapsed().as_secs_f64());
            return Err("GetToken timeout".to_string());
        }
        
        let sdk_access_token = token_data.access_token.lock().unwrap().clone().ok_or("No access token received")?;
        let sdk_refresh_token = token_data.refresh_token.lock().unwrap().clone();
        let expires_in = token_data.expires_in.lock().unwrap().clone().unwrap_or(604800);
        let sdk_token_type = token_data.token_type.lock().unwrap().clone().unwrap_or(1);  // Default to Bearer (1) if not provided
        
        eprintln!("[Rust] Got OAuth access token (len={}), calling UpdateToken with token_type={}", sdk_access_token.len(), sdk_token_type);
        
        // Send full OAuth token info to TypeScript for storage - INCLUDE TOKEN TYPE!
        if let Some(refresh) = &sdk_refresh_token {
            eprintln!("[Rust] OAuth_TOKEN_FOR_STORAGE: access={},refresh={},expires={},type={}", sdk_access_token, refresh, expires_in, sdk_token_type);
        } else {
            eprintln!("[Rust] OAuth_TOKEN_FOR_STORAGE: access={},refresh=NONE,expires={},type={}", sdk_access_token, expires_in, sdk_token_type);
        }
        
        // STEP 3: UpdateToken with OAuth access token using proper callbacks
        let token_cstr = CString::new(sdk_access_token.clone()).map_err(|_| "Invalid token string")?;
        let discord_token = DiscordString {
            ptr: token_cstr.as_ptr() as *const u8,
            size: sdk_access_token.len(),
        };
        
        let token_updated = Arc::new(Mutex::new(false));
        let token_updated_for_callback = Arc::clone(&token_updated);
        
        extern "C" fn token_callback_fresh(_result: *mut DiscordClientResult, user_data: *mut c_void) {
            eprintln!("[Rust] ✅ UpdateToken callback fired (fresh auth path)");
            unsafe {
                let flag = &*(user_data as *const Arc<Mutex<bool>>);
                *flag.lock().unwrap() = true;
            }
        }
        extern "C" fn token_free_fresh(ptr: *mut c_void) {
            if !ptr.is_null() {
                unsafe { let _ = Box::from_raw(ptr as *mut Arc<Mutex<bool>>); }
            }
        }
        
        let user_data = Box::into_raw(Box::new(token_updated_for_callback)) as *mut c_void;
        
        eprintln!("[Rust] Calling UpdateToken with token_type={} (from Discord)", sdk_token_type);
        Discord_Client_UpdateToken(client.as_mut(), sdk_token_type, discord_token, token_callback_fresh, token_free_fresh, user_data);
        
        // Wait for callback to fire
        let wait_start = std::time::Instant::now();
        while wait_start.elapsed() < Duration::from_secs(5) {
            Discord_RunCallbacks();
            if *token_updated.lock().unwrap() { break; }
            thread::sleep(Duration::from_millis(50));
        }
        
        if !*token_updated.lock().unwrap() {
            eprintln!("[Rust] ⚠️  UpdateToken callback did not fire within timeout");
        }
        
        // Validate token before Connect
        eprintln!("[Rust] Token validation (fresh OAuth path):");
        eprintln!("[Rust]   Type: Bearer");
        eprintln!("[Rust]   Length: {}", sdk_access_token.len());
        eprintln!("[Rust]   Expires in: {} seconds", expires_in);
        if sdk_access_token.is_empty() {
            return Err("Access token is empty".to_string());
        }
        if sdk_access_token.len() < 20 {
            return Err("Access token appears malformed (too short)".to_string());
        }
        eprintln!("[Rust]   Status: ✅ Valid");
        
        // CRITICAL: Wait for Discord app to fully initialize with the new account
        // If user just switched Discord accounts, the app needs time to settle
        eprintln!("[Rust] ⏳ Waiting 3 seconds for Discord app to fully load new account...");
        eprintln!("[Rust]    (If you just switched Discord accounts, ensure the app shows the new account)");
        let wait_discord = std::time::Instant::now();
        while wait_discord.elapsed() < Duration::from_secs(3) {
            Discord_RunCallbacks();
            thread::sleep(Duration::from_millis(100));
        }
        
        // Call Connect after token is confirmed set
        eprintln!("[Rust] Calling Connect after UpdateToken callback");
        Discord_Client_Connect(client.as_mut());
        eprintln!("[Rust] Connect call completed");
        
        let client_ptr: usize = Box::into_raw(client) as usize;
        *CLIENT_PTR.lock().unwrap() = client_ptr;
        *TOKEN.lock().unwrap() = Some(token_cstr);
        
        // Process callbacks to let status updates come through
        eprintln!("[Rust] Processing callbacks after Connect...");
        let callback_start = std::time::Instant::now();
        while callback_start.elapsed() < Duration::from_millis(200) {
            Discord_RunCallbacks();
            thread::sleep(Duration::from_millis(20));
        }
        
        // Wait for SDK to reach Ready status (status >= 3)
        eprintln!("[Rust] Waiting for SDK to reach Ready status (need status >= 3)...");
        eprintln!("[Rust] Status meanings: 0=Uninitialized, 1=Connecting, 2=Connected, 3=Ready");
        let connect_wait = std::time::Instant::now();
        let mut last_status = 0;
        let mut error_4004_seen = false;
        
        while connect_wait.elapsed() < Duration::from_secs(30) {
            Discord_RunCallbacks();
            let status = *CURRENT_STATUS.lock().unwrap();
            
            if status != last_status {
                eprintln!("[Rust] Status changed to: {}", status);
                last_status = status;
            }
            
            if status >= 3 {
                eprintln!("[Rust] ✅ SDK reached Ready status: {}", status);
                *INITIALIZED.lock().unwrap() = true;
                return Ok("initialized".to_string());
            }
            
            // If we see status 0 right after status 2, that's error 4004
            if status == 0 && last_status == 2 {
                if !error_4004_seen {
                    error_4004_seen = true;
                    eprintln!("[Rust] ⚠️  Got error 4004 (status went 2→0), but continuing to retry...");
                }
            }
            
            thread::sleep(Duration::from_millis(200));
        }
        
        if error_4004_seen {
            eprintln!("[Rust] ❌ SDK failed with error 4004 - Discord app not configured for SDK access");
            return Err("SDK error 4004 - app not configured for SDK in Developer Portal".to_string());
        }
        
        let final_status = *CURRENT_STATUS.lock().unwrap();
        return Err(format!("SDK connection timeout - stuck at status={}", final_status));
    }
}

fn cleanup() {
    if let Ok(mut client_ptr) = CLIENT_PTR.lock() {
        if *client_ptr != 0 {
            unsafe {
                let client_box = Box::from_raw(*client_ptr as *mut DiscordClient);
                Discord_Client_Drop(client_box.as_ref() as *const _ as *mut _);
            }
        }
        *client_ptr = 0;
    }
    if let Ok(mut token_guard) = TOKEN.lock() {
        token_guard.take();
    }
    if let Ok(mut init_guard) = INITIALIZED.lock() {
        *init_guard = false;
    }
}
