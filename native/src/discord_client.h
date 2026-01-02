#ifndef DISCORD_CLIENT_H
#define DISCORD_CLIENT_H

#include <string>
#include <vector>
#include <memory>
#include <cstdint>
#include <atomic>
#include <chrono>
#include <mutex>
#include <thread>
#include "cdiscord.h"  // Discord SDK C API

struct Channel {
  std::string id;
  std::string name;
  int type;
  int position;
  std::string parent_id;
};

struct Guild {
  std::string id;
  std::string name;
  std::string icon;
  bool owner;
};

struct User {
  std::string id;
  std::string username;
  std::string avatar;
  std::string discriminator;
};

class DiscordClient {
public:
  DiscordClient();
  ~DiscordClient();

  // Initialize with app ID and OAuth access token (from TypeScript layer)
  bool Initialize(const std::string& application_id, const std::string& access_token);
  void Disconnect();
  void RunCallbacks();
  void FetchGuilds();  // Request guilds from Discord (async - requires RunCallbacks to be called)

  std::vector<Guild> GetGuilds();
  std::vector<Channel> GetGuildChannels(const std::string& guild_id);
  User GetCurrentUser();

  bool SendMessage(const std::string& channel_id, const std::string& user_id, const std::string& content);
  bool JoinVoiceChannel(const std::string& guild_id, const std::string& channel_id);
  bool LeaveVoiceChannel();
  bool SetActivityRichPresence(const std::string& details, const std::string& state);

private:
  bool initialized = false;
  bool ready = false;
  std::chrono::steady_clock::time_point init_time;
  
  // Cached data
  std::vector<Guild> cached_guilds;
  std::vector<Channel> cached_channels;
  User cached_user;
};

#endif // DISCORD_CLIENT_H
