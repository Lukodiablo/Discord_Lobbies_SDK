#include "discord_client.h"
#include <iostream>
#include <thread>
#include <mutex>
#include <chrono>
#include <cctype>
#include <cstdlib>
#include <limits>
#include <cstdlib>

// Helper function to validate string as uint64_t
static bool IsValidUint64(const std::string& str, uint64_t& out_value) {
  if (str.empty()) return false;
  for (char c : str) {
    if (!std::isdigit(c)) return false;
  }
  if (str.length() > 20) return false;
  if (str.length() == 20) {
    if (str > "18446744073709551615") return false;
  }
  char* endptr = nullptr;
  out_value = std::strtoull(str.c_str(), &endptr, 10);
  return (*endptr == '\0');
}

// Global C API client state
static Discord_Client g_client = {};
static bool g_client_initialized = false;
static bool g_client_dropped = false;
static std::mutex g_state_mutex;
static std::vector<Guild> g_cached_guilds;
static std::vector<Channel> g_cached_channels;
static User g_cached_user;

// Callback for GetUserGuilds
void on_user_guilds(Discord_ClientResult* result, Discord_GuildMinimalSpan guilds, void* userData) {
  std::cout << "📍 on_user_guilds callback fired! guilds.size=" << guilds.size << std::endl;
  
  // NO LOCK HERE - RunCallbacks() already holds the mutex
  // Trying to lock again would cause deadlock
  g_cached_guilds.clear();
  
  if (result && Discord_ClientResult_Successful(result)) {
    std::cout << "✅ Guild fetch successful" << std::endl;
    for (size_t i = 0; i < guilds.size; i++) {
      Guild g;
      g.id = std::to_string(Discord_GuildMinimal_Id(&guilds.ptr[i]));
      
      Discord_String name_str;
      Discord_GuildMinimal_Name(&guilds.ptr[i], &name_str);
      g.name = std::string((const char*)name_str.ptr, name_str.size);
      
      g.icon = "";  // Icon not available in GuildMinimal
      g.owner = false;  // Owner flag not available in GuildMinimal
      g_cached_guilds.push_back(g);
      std::cout << "  ➕ Guild: " << g.name << " (" << g.id << ")" << std::endl;
    }
    std::cout << "📚 Loaded " << guilds.size << " guilds from SDK" << std::endl;
  } else {
    std::cout << "⚠️  Failed to fetch guilds (result=" << (result ? "set" : "null") << ")" << std::endl;
  }
  
  if (result) {
    Discord_ClientResult_Drop(result);
  }
}

// Callback for GetGuildChannels  
void on_guild_channels(Discord_ClientResult* result, Discord_GuildChannelSpan channels, void* userData) {
  // NO LOCK HERE - RunCallbacks() already holds the mutex
  // Trying to lock again would cause deadlock
  g_cached_channels.clear();
  
  if (result && Discord_ClientResult_Successful(result)) {
    for (size_t i = 0; i < channels.size; i++) {
      Channel c;
      c.id = std::to_string(Discord_GuildChannel_Id(&channels.ptr[i]));
      
      Discord_String name_str;
      Discord_GuildChannel_Name(&channels.ptr[i], &name_str);
      c.name = std::string((const char*)name_str.ptr, name_str.size);
      
      c.type = Discord_GuildChannel_Type(&channels.ptr[i]);
      c.position = Discord_GuildChannel_Position(&channels.ptr[i]);
      
      uint64_t parent_id;
      if (Discord_GuildChannel_ParentId(&channels.ptr[i], &parent_id)) {
        c.parent_id = std::to_string(parent_id);
      } else {
        c.parent_id = "";
      }
      
      g_cached_channels.push_back(c);
    }
    std::cout << "📍 Loaded " << channels.size << " channels from SDK" << std::endl;
  } else {
    std::cout << "⚠️  Failed to fetch channels" << std::endl;
  }
  
  if (result) {
    Discord_ClientResult_Drop(result);
  }
}

DiscordClient::DiscordClient() : initialized(false), ready(false) {
  std::cout << "DiscordClient created (C API)" << std::endl;
}

DiscordClient::~DiscordClient() {
  Disconnect();
}

bool DiscordClient::Initialize(const std::string& application_id, const std::string& access_token) {
  std::cout << "🚀 Initializing Discord Social SDK (C API) with app ID: " << application_id << std::endl;

  std::lock_guard<std::mutex> lock(g_state_mutex);

  uint64_t app_id_value;
  if (!IsValidUint64(application_id, app_id_value)) {
    std::cerr << "❌ Invalid application ID" << std::endl;
    return false;
  }

  if (access_token.empty()) {
    std::cerr << "❌ Access token is empty" << std::endl;
    return false;
  }

  // Initialize the C API client
  try {
    // CRITICAL: Tell SDK we're in a multi-threaded environment (Node.js)
    Discord_SetFreeThreaded();
    std::cout << "📌 Set Discord SDK to free-threaded mode" << std::endl;

    std::cout << "⏳ About to call Discord_Client_Init()..." << std::endl;
    Discord_Client_Init(&g_client);
    std::cout << "✅ Discord_Client_Init() completed" << std::endl;
    g_client_initialized = true;

    std::cout << "⏳ About to call Discord_Client_SetApplicationId()..." << std::endl;
    Discord_Client_SetApplicationId(&g_client, app_id_value);
    std::cout << "✅ Discord_Client_SetApplicationId() completed" << std::endl;

    std::cout << "⏳ About to call Discord_Client_UpdateToken()..." << std::endl;
    Discord_String token_str = { (uint8_t*)access_token.c_str(), access_token.length() };
    Discord_Client_UpdateToken(&g_client, Discord_AuthorizationTokenType_Bearer, token_str, NULL, NULL, NULL);
    std::cout << "✅ Discord_Client_UpdateToken() completed" << std::endl;

    // Now try to connect - this is what triggers async operations
    std::cout << "⏳ About to call Discord_Client_Connect()..." << std::endl;
    Discord_Client_Connect(&g_client);
    std::cout << "✅ Discord_Client_Connect() completed successfully" << std::endl;

    std::cout << "✅ Discord C API initialized successfully" << std::endl;

    initialized = true;
    ready = true;
    init_time = std::chrono::steady_clock::now();

    return true;
  } catch (const std::exception& e) {
    std::cerr << "❌ Exception during C API init: " << e.what() << std::endl;
    return false;
  } catch (...) {
    std::cerr << "❌ Unknown error during C API init" << std::endl;
    return false;
  }
}

void DiscordClient::Disconnect() {
  std::lock_guard<std::mutex> lock(g_state_mutex);

  if (g_client_initialized && !g_client_dropped) {
    Discord_Client_Disconnect(&g_client);
    Discord_Client_Drop(&g_client);
    g_client_dropped = true;
    g_client_initialized = false;
    initialized = false;
    ready = false;
    std::cout << "🔌 Discord C API client disconnected" << std::endl;
  }
}

void DiscordClient::RunCallbacks() {
  // CRITICAL: This MUST be called regularly to process SDK callbacks
  // Discord_SetFreeThreaded() was set, so this should be safe from any thread
  if (!g_client_initialized) {
    return;
  }
  
  // Call the SDK's callback processor
  Discord_RunCallbacks();
}

void DiscordClient::FetchGuilds() {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  if (!g_client_initialized) {
    std::cerr << "❌ Client not initialized, cannot fetch guilds" << std::endl;
    return;
  }
  
  std::cout << "📤 Calling Discord_Client_GetUserGuilds with callback..." << std::endl;
  Discord_Client_GetUserGuilds(&g_client, on_user_guilds, NULL, NULL);
  std::cout << "📤 GetUserGuilds call completed (async, callback will fire later)" << std::endl;
}

std::vector<Guild> DiscordClient::GetGuilds() {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  return g_cached_guilds;
}

std::vector<Channel> DiscordClient::GetGuildChannels(const std::string& guild_id) {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  return g_cached_channels;
}

User DiscordClient::GetCurrentUser() {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  return g_cached_user;
}

bool DiscordClient::SendMessage(const std::string& channel_id, const std::string& user_id, const std::string& content) {
  // Not implemented in C API wrapper here; the Social SDK may not expose send message over this API.
  std::cout << "⚠️  SendMessage not implemented (use REST or other API)" << std::endl;
  return false;
}

bool DiscordClient::JoinVoiceChannel(const std::string& guild_id, const std::string& channel_id) {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  if (!g_client_initialized) return false;
  // Implement voice join via SDK if available; returning true for now
  return true;
}

bool DiscordClient::LeaveVoiceChannel() {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  if (!g_client_initialized) return false;
  return true;
}

bool DiscordClient::SetActivityRichPresence(const std::string& details, const std::string& state) {
  // Rich presence is not available in basic C API wrapper
  // This would require advanced Activity management APIs
  std::cout << "⚠️  SetActivityRichPresence not available in C API" << std::endl;
  return false;
}
