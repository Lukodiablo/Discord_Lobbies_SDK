#include <napi.h>
#include <queue>
#include <mutex>
#include <string>

struct Message {
  std::string channel_id;
  std::string user_id;
  std::string username;
  std::string content;
  int64_t timestamp;
};

class MessageHandler {
public:
  static void QueueMessage(const Message& msg);
  static Message GetNextMessage();
  static bool HasMessages();
  static void ClearQueue();

private:
  static std::queue<Message> message_queue;
  static std::mutex queue_mutex;
};

std::queue<Message> MessageHandler::message_queue;
std::mutex MessageHandler::queue_mutex;

void MessageHandler::QueueMessage(const Message& msg) {
  std::lock_guard<std::mutex> lock(queue_mutex);
  message_queue.push(msg);
}

Message MessageHandler::GetNextMessage() {
  std::lock_guard<std::mutex> lock(queue_mutex);
  if (message_queue.empty()) {
    return Message{"", "", "", "", 0};
  }
  Message msg = message_queue.front();
  message_queue.pop();
  return msg;
}

bool MessageHandler::HasMessages() {
  std::lock_guard<std::mutex> lock(queue_mutex);
  return !message_queue.empty();
}

void MessageHandler::ClearQueue() {
  std::lock_guard<std::mutex> lock(queue_mutex);
  while (!message_queue.empty()) {
    message_queue.pop();
  }
}
