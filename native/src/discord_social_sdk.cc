#include <napi.h>
#include "discord_client.h"
#include <iostream>
#include <cstdlib>

// Suppress Discord SDK cleanup-related crashes by exiting before cleanup
void suppress_discord_cleanup_crash() {
  // Just exit the process hard to skip any cleanup that could segfault
  // This is a workaround for Discord SDK cleanup issues
  std::cerr << "🚪 Forcing clean exit to prevent Discord SDK cleanup segfault" << std::endl;
  std::exit(0);
}

class DiscordAddon : public Napi::ObjectWrap<DiscordAddon> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  DiscordAddon(const Napi::CallbackInfo& info);
  ~DiscordAddon();

private:
  static Napi::FunctionReference constructor;
  
  // Native methods
  Napi::Value Initialize(const Napi::CallbackInfo& info);
  Napi::Value GetGuildChannels(const Napi::CallbackInfo& info);
  Napi::Value SendMessage(const Napi::CallbackInfo& info);
  Napi::Value GetCurrentUser(const Napi::CallbackInfo& info);
  Napi::Value GetGuilds(const Napi::CallbackInfo& info);
  Napi::Value RunCallbacks(const Napi::CallbackInfo& info);
  Napi::Value FetchGuilds(const Napi::CallbackInfo& info);
  Napi::Value JoinVoiceChannel(const Napi::CallbackInfo& info);
  Napi::Value LeaveVoiceChannel(const Napi::CallbackInfo& info);
  Napi::Value SetActivityRichPresence(const Napi::CallbackInfo& info);
  Napi::Value Disconnect(const Napi::CallbackInfo& info);
  
  DiscordClient client;
};

Napi::FunctionReference DiscordAddon::constructor;

Napi::Object DiscordAddon::Init(Napi::Env env, Napi::Object exports) {
  // Register cleanup handler to prevent Discord SDK crash on exit
  std::atexit(suppress_discord_cleanup_crash);
  
  Napi::Function func = DefineClass(env, "DiscordAddon", {
    InstanceMethod("initialize", &DiscordAddon::Initialize),
    InstanceMethod("getGuildChannels", &DiscordAddon::GetGuildChannels),
    InstanceMethod("sendMessage", &DiscordAddon::SendMessage),
    InstanceMethod("getCurrentUser", &DiscordAddon::GetCurrentUser),
    InstanceMethod("getGuilds", &DiscordAddon::GetGuilds),
    InstanceMethod("runCallbacks", &DiscordAddon::RunCallbacks),
    InstanceMethod("fetchGuilds", &DiscordAddon::FetchGuilds),
    InstanceMethod("joinVoiceChannel", &DiscordAddon::JoinVoiceChannel),
    InstanceMethod("leaveVoiceChannel", &DiscordAddon::LeaveVoiceChannel),
    InstanceMethod("setActivityRichPresence", &DiscordAddon::SetActivityRichPresence),
    InstanceMethod("disconnect", &DiscordAddon::Disconnect),
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("DiscordAddon", func);
  return exports;
}

DiscordAddon::DiscordAddon(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<DiscordAddon>(info) {
  std::cout << "🔧 DiscordAddon constructor called" << std::endl;
}

DiscordAddon::~DiscordAddon() {
  // NOTE: Discord Social SDK has issues with cleanup on process exit
  // We intentionally don't call client.Disconnect() here to avoid segfaults
  // The OS will clean up the process memory anyway
  std::cout << "🧹 DiscordAddon destructor called (not calling disconnect)" << std::endl;
}

Napi::Value DiscordAddon::Initialize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 2) {
    Napi::TypeError::New(env, "Expected application ID and access token").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string app_id = info[0].As<Napi::String>();
  std::string access_token = info[1].As<Napi::String>();
  
  if (!client.Initialize(app_id, access_token)) {
    Napi::Error::New(env, "Failed to initialize Discord client").ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::Boolean::New(env, true);
}

Napi::Value DiscordAddon::GetGuildChannels(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected guild ID").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string guild_id = info[0].As<Napi::String>();
  auto channels = client.GetGuildChannels(guild_id);

  Napi::Array result = Napi::Array::New(env);
  uint32_t index = 0;

  for (const auto& channel : channels) {
    Napi::Object channel_obj = Napi::Object::New(env);
    channel_obj.Set("id", Napi::String::New(env, channel.id));
    channel_obj.Set("name", Napi::String::New(env, channel.name));
    channel_obj.Set("type", Napi::Number::New(env, channel.type));
    channel_obj.Set("position", Napi::Number::New(env, channel.position));
    channel_obj.Set("parentId", Napi::String::New(env, channel.parent_id));
    result.Set(index++, channel_obj);
  }

  return result;
}

Napi::Value DiscordAddon::SendMessage(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Expected channel ID, user ID, and message content").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string channel_id = info[0].As<Napi::String>();
  std::string user_id = info[1].As<Napi::String>();
  std::string content = info[2].As<Napi::String>();

  if (!client.SendMessage(channel_id, user_id, content)) {
    Napi::Error::New(env, "Failed to send message").ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::Boolean::New(env, true);
}

Napi::Value DiscordAddon::GetCurrentUser(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto user = client.GetCurrentUser();

  Napi::Object user_obj = Napi::Object::New(env);
  user_obj.Set("id", Napi::String::New(env, user.id));
  user_obj.Set("username", Napi::String::New(env, user.username));
  user_obj.Set("avatar", Napi::String::New(env, user.avatar));
  user_obj.Set("discriminator", Napi::String::New(env, user.discriminator));

  return user_obj;
}

Napi::Value DiscordAddon::GetGuilds(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto guilds = client.GetGuilds();

  Napi::Array result = Napi::Array::New(env);
  uint32_t index = 0;

  for (const auto& guild : guilds) {
    Napi::Object guild_obj = Napi::Object::New(env);
    guild_obj.Set("id", Napi::String::New(env, guild.id));
    guild_obj.Set("name", Napi::String::New(env, guild.name));
    guild_obj.Set("icon", Napi::String::New(env, guild.icon));
    guild_obj.Set("owner", Napi::Boolean::New(env, guild.owner));
    result.Set(index++, guild_obj);
  }

  return result;
}

Napi::Value DiscordAddon::RunCallbacks(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  client.RunCallbacks();
  return env.Undefined();
}

Napi::Value DiscordAddon::FetchGuilds(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  client.FetchGuilds();
  return env.Undefined();
}

Napi::Value DiscordAddon::JoinVoiceChannel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 2) {
    Napi::TypeError::New(env, "Expected guild ID and channel ID").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string guild_id = info[0].As<Napi::String>();
  std::string channel_id = info[1].As<Napi::String>();

  if (!client.JoinVoiceChannel(guild_id, channel_id)) {
    Napi::Error::New(env, "Failed to join voice channel").ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::Boolean::New(env, true);
}

Napi::Value DiscordAddon::LeaveVoiceChannel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!client.LeaveVoiceChannel()) {
    Napi::Error::New(env, "Failed to leave voice channel").ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::Boolean::New(env, true);
}

Napi::Value DiscordAddon::SetActivityRichPresence(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected activity object").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object activity = info[0].As<Napi::Object>();
  std::string details = activity.Get("details").As<Napi::String>();
  std::string state = activity.Get("state").As<Napi::String>();

  if (!client.SetActivityRichPresence(details, state)) {
    Napi::Error::New(env, "Failed to set rich presence").ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::Boolean::New(env, true);
}

Napi::Value DiscordAddon::Disconnect(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  client.Disconnect();
  return Napi::Boolean::New(env, true);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return DiscordAddon::Init(env, exports);
}

NODE_API_MODULE(discord_social_sdk, Init)
