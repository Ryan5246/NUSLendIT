import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'; 

// Sub-component to resolve usernames in real-time
function ChatRoomCard({ room, currentUserId, onOpen }) {
  const [peerHandle, setPeerHandle] = useState('Loading...');
  const peerId = room.participants?.find(id => id !== currentUserId);

  useEffect(() => {
    const fetchPeerHandle = async () => {
      if (!peerId) {
        setPeerHandle('Unknown User');
        return;
      }
      try {
        const docSnap = await getDoc(doc(db, 'username', peerId));
        if (docSnap.exists() && docSnap.data().username) {
          setPeerHandle(`💬 @${docSnap.data().username}`);
        } else {
          setPeerHandle('Campus Peer');
        }
      } catch (err) {
        setPeerHandle('Campus Peer');
      }
    };
    fetchPeerHandle();
  }, [peerId]);

  // 👈 NEW: Check if the last message was sent before the user cleared their history
  const clearTime = room.clearedTimestamps?.[currentUserId] || 0;
  const msgTime = room.lastMessageTimestamp || 0;
  const showPreviewText = msgTime > clearTime;

  return (
    <TouchableOpacity 
      style={styles.roomCard} 
      onPress={() => {
        const cleanHandle = peerHandle.replace('💬 ', '').replace('@', '');
        onOpen(room, peerId, cleanHandle);
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.usernameTag}>{peerHandle}</Text>
        <Text style={styles.timeTag}>
          {room.lastMessageTimestamp ? new Date(room.lastMessageTimestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
        </Text>
      </View>
      <Text style={styles.itemContext}>Regarding: {room.itemTitle || 'Marketplace Item'}</Text>
      <Text style={styles.lastMessagePreview} numberOfLines={1}>
        {/* 👈 DYNAMIC PREVIEW TEXT MASKING */}
        {showPreviewText ? (room.lastMessageText || 'No messages exchanged yet...') : 'History cleared'}
      </Text>
    </TouchableOpacity>
  );
}

export default function ChatListScreen({ navigation }) {
  const [chatRooms, setChatRooms] = useState([]);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUserId) return;

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUserId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allRooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const visibleRooms = [...allRooms];
      visibleRooms.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
      setChatRooms(visibleRooms);
    }, (error) => {
      console.error("Error streaming chat inbox index: ", error);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const handleOpenRoom = (room, peerId, resolvedUsername) => {
    navigation.navigate('ChatConversation', {
      chatId: room.id,
      itemTitle: room.itemTitle,
      peerId: peerId,
      peerUsername: resolvedUsername
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.headerTitle}>LendIT Inbox</Text>
        <Text style={styles.headerSubtitle}>Active Campus Negotiation Threads</Text>
      </View>

      {chatRooms.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No active chats found.</Text>
          <Text style={styles.emptySubtext}>Offer or request items on the search feed to begin negotiating!</Text>
        </View>
      ) : (
        <FlatList
          data={chatRooms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatRoomCard 
              room={item} 
              currentUserId={currentUserId} 
              onOpen={(room, peerId, usernameStr) => handleOpenRoom(room, peerId, usernameStr)} 
            />
          )}
          contentContainerStyle={styles.listPadding}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  headerBlock: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e5ea', backgroundColor: '#ffffff' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#14004c' },
  headerSubtitle: { fontSize: 13, color: '#8e8e93', marginTop: 4 },
  listPadding: { padding: 16 },
  roomCard: { 
    backgroundColor: '#fafafa', 
    padding: 16, 
    borderRadius: 14, 
    marginBottom: 12, 
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderLeftWidth: 5, 
    borderLeftColor: '#14004c' 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  usernameTag: { color: '#14004c', fontSize: 17, fontWeight: 'bold' },
  timeTag: { color: '#8e8e93', fontSize: 12 },
  itemContext: { color: '#8e8e93', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  lastMessagePreview: { color: '#333333', fontSize: 14, fontWeight: '400', fontStyle: 'italic' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#14004c', fontSize: 18, fontWeight: 'bold' },
  emptySubtext: { color: '#8e8e93', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }
});