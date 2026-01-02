#include "discord_client.h"
#include <iostream>
#include <thread>
#include <mutex>
#include <chrono>
#include <cctype>
#include <cstdlib>
#include <limits>

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

// Global state - C API
static Discord_Client g_client = {};
static std::mutex g_state_mutex;
static std::vector<Guild> g_cached_guilds;
static std::vector<Channel> g_cached_channels;
static User g_cached_user;
static bool g_initialized = false;

DiscordClient::DiscordClient() : initialized(false), ready(false) {
  std::cout << "DiscordClient created" << std::endl;
}

DiscordClient::~DiscordClient() {
  Disconnect();
}

bool DiscordClient::Initialize(const std::string& application_id, const std::string& access_token) {
  std::cout << "🚀 Initializing Discord Social SDK with app ID: " << application_id << std::endl;
  
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
  
  try {
    std::cout << "📝 Initializing Discord SDK C API..." << std::endl;
    Discord_Client_Init(&g_client);
    g_initialized = true;
    std::cout << "✅ Discord SDK initialized" << std::endl;
    
    std::cout << "📝 Setting application ID..." << std::endl;
    Discord_Client_SetApplicationId(&g_client, app_id_value);
    std::cout << "✅ Application ID set" << std::endl;
    
    std::cout << "📝 Updating OAuth token..." << std::endl;
    Discord_String token_str = {
      (uint8_t*)access_token.c_str(),
      access_token.length()
    };
    Discord_Client_UpdateToken(&g_client, DiscordAuthorizationTokenType_Bearer, &token_str);
    std::cout << "✅ Token updated" << std::endl;
    
    std::cout << "🔌 Connecting to Discord..." << std::endl;
    Discord_Client_Connect(&g_client);
    std::cout << "✅ Connect initiated" << std::endl;
    
    std::cout << "📚 Requesting user guilds..." << std::endl;
    Discord_Client_GetUserGuilds(&g_client, NULL, NULL);
    
    initialized = true;
    ready = true;
    init_time = std::chrono::steady_clock::now();
    
    std::cout << "✅ Discord Social SDK initialization complete" << std::endl;
    return true;
  } catch (const std::exception& e) {
    std::cerr << "❌ Exception: " << e.what() << std::endl;
    return false;
  } catch (...) {
    std::cerr << "❌ Unknown error" << std::endl;
    return false;
  }
}

void DiscordClient::Disconnect() {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  
  if (g_initialized) {
    Discord_Client_Disconnect(&g_client);
    Discord_Client_Destroy(&g_client);
    g_initialized = false;
    initialized = false;
    std::cout << "🔌 Discord client disconnected" << std::endl;
  }
}

void DiscordClient::RunCallbacks() {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  if (g_initialized) {
    Discord_RunCallbacks();
  }
}

std::vector<Guild> DiscordClient::GetGuilds() {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  return g_cached_guilds;
}

std::vector<Channel> DiscordClient::GetGuildChannels(const std::string& guild_id) {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  
  if (!g_cached_channels.empty()) {
    return g_cached_channels;
  }
  
  if (g_initialized) {
    uint64_t gid;
    if (IsValidUint64(guild_id, gid)) {
      Discord_Client_GetGuildChannels(&g_client, gid, NULL, NULL);
    }
  }
  
  return g_cached_channels;
}

User DiscordClient::GetCurrentUser() {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  return g_cached_user;
}

bool DiscordClient::SetActivityRichPresence(const std::string& details, const std::string& state) {
  std::lock_guard<std::mutex> lock(g_state_mutex);
  
  if (!g_initialized) return false;
  
  Discord_Activity activity = {};
  Discord_Activity_SetDetails(&activity, details.c_str());
  Discord_Activity_SetState(&activity, state.c_str());
  
  Discord_Client_UpdateActivity(&g_client, &activity, NULL, NULL);
  
  return true;
}
