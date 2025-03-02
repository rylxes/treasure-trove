import React, {useEffect, useState} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';
import {Send} from 'lucide-react';
import {format} from 'date-fns';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  item_id: string | null;
  sender: {
    username: string;
  };
  item?: {
    title: string;
    images: string[];
  };
}

interface Conversation {
  user_id: string;
  username: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchConversations();
      const subscription = supabase
        .channel('messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        }, (payload) => {
          handleNewMessage(payload.new as Message);
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser);
      markMessagesAsRead(selectedUser);
    }
  }, [selectedUser]);

  async function fetchConversations() {
    try {
      const { data, error } = await supabase.rpc('get_conversations', {
        user_id: user!.id
      });

      if (error) throw error;
      setConversations(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }

  async function fetchMessages(otherUserId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(username),
          item:item_id(title, images)
        `)
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .or(`sender_id.eq.${otherUserId},receiver_id.eq.${otherUserId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }

  async function markMessagesAsRead(senderId: string) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', user!.id)
        .eq('read', false);

      if (error) throw error;
      fetchConversations();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    try {
      const { error } = await supabase.from('messages').insert({
        content: newMessage.trim(),
        sender_id: user!.id,
        receiver_id: selectedUser
      });

      if (error) throw error;
      setNewMessage('');
      fetchMessages(selectedUser);
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  function handleNewMessage(message: Message) {
    if (selectedUser === message.sender_id) {
      setMessages(prev => [...prev, message]);
    }
    fetchConversations();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="grid grid-cols-12 min-h-[600px]">
          {/* Conversations List */}
          <div className="col-span-4 border-r">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold">Messages</h2>
            </div>
            <div className="overflow-y-auto h-[calc(600px-4rem)]">
              {loading ? (
                <div className="p-4 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-12 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              ) : conversations.length > 0 ? (
                conversations.map((conversation) => (
                  <button
                    key={conversation.user_id}
                    onClick={() => setSelectedUser(conversation.user_id)}
                    className={`w-full p-4 text-left hover:bg-gray-50 ${
                      selectedUser === conversation.user_id ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${conversation.username}`}
                        alt={conversation.username}
                        className="w-10 h-10 rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">
                            {conversation.username}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(conversation.last_message_time), 'MMM d')}
                          </p>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {conversation.last_message}
                        </p>
                      </div>
                      {conversation.unread_count > 0 && (
                        <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No conversations yet
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="col-span-8 flex flex-col">
            {selectedUser ? (
              <>
                <div className="p-4 border-b">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${
                        conversations.find(c => c.user_id === selectedUser)?.username
                      }`}
                      alt="User avatar"
                      className="w-10 h-10 rounded-full"
                    />
                    <h3 className="font-medium">
                      {conversations.find(c => c.user_id === selectedUser)?.username}
                    </h3>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => {
                    const isOwn = message.sender_id === user!.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] ${
                            isOwn
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          } rounded-lg px-4 py-2`}
                        >
                          {message.item && (
                            <div className="mb-2 p-2 bg-white/10 rounded">
                              <div className="flex items-center gap-2">
                                {message.item.images?.[0] && (
                                  <img
                                    src={message.item.images[0]}
                                    alt={message.item.title}
                                    className="w-10 h-10 object-cover rounded"
                                  />
                                )}
                                <p className="text-sm">{message.item.title}</p>
                              </div>
                            </div>
                          )}
                          <p>{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              isOwn ? 'text-white/70' : 'text-gray-500'
                            }`}
                          >
                            {format(new Date(message.created_at), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleSendMessage} className="p-4 border-t">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a conversation to start messaging
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}