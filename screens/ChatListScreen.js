import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
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

  const clearTime = room.clearedTimestamps?.[currentUserId] || 0;
  const msgTime = room.lastMessageTimestamp || 0;
  const readTime = room.readTimestamps?.[currentUserId] || 0;
  const showPreviewText = msgTime > clearTime;
  const isUnread = Boolean(
    showPreviewText &&
    room.lastMessageSenderId &&
    room.lastMessageSenderId !== currentUserId &&
    msgTime > readTime
  );

  return (
    <TouchableOpacity 
      style={[styles.roomCard, isUnread && styles.roomCardUnread]} 
      onPress={() => {
        const cleanHandle = peerHandle.replace('💬 ', '').replace('@', '');
        onOpen(room, peerId, cleanHandle);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.usernameRow}>
          {isUnread && <View style={styles.unreadDot} />}
          <Text style={[styles.usernameTag, isUnread && styles.usernameTagUnread]}>{peerHandle}</Text>
        </View>
        <Text style={[styles.timeTag, isUnread && styles.timeTagUnread]}>
          {room.lastMessageTimestamp ? new Date(room.lastMessageTimestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
        </Text>
      </View>
      <Text style={styles.itemContext}>Regarding: {room.itemTitle || 'Marketplace Item'}</Text>
      <View style={styles.previewRow}>
        <Text style={[styles.lastMessagePreview, isUnread && styles.lastMessagePreviewUnread]} numberOfLines={1}>
          {showPreviewText ? (room.lastMessageText || 'No messages exchanged yet...') : 'History cleared'}
        </Text>
        {isUnread && <Text style={styles.unreadBadge}>New</Text>}
      </View>
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

  const handleOpenRoom = async (room, peerId, resolvedUsername) => {
    try {
      await updateDoc(doc(db, 'chats', room.id), {
        [`readTimestamps.${currentUserId}`]: Date.now()
      });
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }

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
    borderLeftColor: '#d1d1d6' 
  },
  roomCardUnread: { backgroundColor: '#ffffff', borderColor: '#14004c', borderLeftColor: '#14004c', shadowColor: '#14004c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#14004c', marginRight: 8 },
  usernameTag: { color: '#14004c', fontSize: 17, fontWeight: '600', flexShrink: 1 },
  usernameTagUnread: { fontWeight: '900' },
  timeTag: { color: '#8e8e93', fontSize: 12 },
  timeTagUnread: { color: '#14004c', fontWeight: '800' },
  itemContext: { color: '#8e8e93', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  lastMessagePreview: { color: '#333333', fontSize: 14, fontWeight: '400', fontStyle: 'italic', flex: 1 },
  lastMessagePreviewUnread: { color: '#111111', fontWeight: '800', fontStyle: 'normal' },
  unreadBadge: { marginLeft: 10, color: '#ffffff', backgroundColor: '#14004c', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#14004c', fontSize: 18, fontWeight: 'bold' },
  emptySubtext: { color: '#8e8e93', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }
});