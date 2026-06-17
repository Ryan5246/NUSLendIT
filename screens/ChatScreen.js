import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { db, auth } from '../firebaseConfig';
import { 
  collection, doc, getDoc, query, orderBy, onSnapshot, addDoc, updateDoc, serverTimestamp, setDoc, deleteDoc 
} from 'firebase/firestore';

export default function ChatScreen({ route, navigation }) {
  const chatId = route.params?.chatId || route.params?.params?.chatId;
  const itemTitle = route.params?.itemTitle || route.params?.params?.itemTitle || 'Item';
  const peerId = route.params?.peerId || route.params?.params?.peerId;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [peerHandle, setPeerHandle] = useState('Campus Peer');
  const [isPeerBlocked, setIsPeerBlocked] = useState(false);
  const currentUserId = auth.currentUser?.uid;

  const paramsRef = useRef({ chatId: null, peerId: null });

  useEffect(() => {
    paramsRef.current = { chatId, peerId };
    console.log("📍 Active Chat Pointer Diagnostics -> chatId:", chatId, "| peerId:", peerId);
  }, [chatId, peerId]);

  // Real-time listener to check if this specific peer is blocked by us
  useEffect(() => {
    if (!currentUserId || !peerId) return;
    const blockId = `${currentUserId}_${peerId}`;
    const unsubscribe = onSnapshot(doc(db, 'blocks', blockId), (docSnap) => {
      // It is blocked if the document exists and has valid payload attributes
      setIsPeerBlocked(docSnap.exists() && Object.keys(docSnap.data() || {}).length > 0);
    });
    return () => unsubscribe();
  }, [currentUserId, peerId]);

  // Inject upper header navigation options dynamically
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={styles.headerMenuButton}
          onPress={() => {
            const activeChatId = paramsRef.current.chatId;
            const activePeerId = paramsRef.current.peerId;

            const options = [
              { text: "Cancel", style: "cancel" },
              { text: "Clear Chat History", style: "destructive", onPress: () => executeClearHistory(activeChatId) }
            ];

            if (isPeerBlocked) {
              options.push({ text: "Unblock User", onPress: () => executeUnblock(activePeerId) });
            } else {
              options.push({ text: "Block User", style: "destructive", onPress: () => executeBlockWithParams(activePeerId) });
            }

            Alert.alert("Chat Options", "What would you like to do?", options);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.headerMenuText}>•••</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, isPeerBlocked]);

  // LOCAL DELETE: Sets a timestamp threshold; filters out older messages locally without dropping the room
  const executeClearHistory = async (targetId) => {
    if (!targetId) return;
    try {
      const chatRef = doc(db, 'chats', targetId);
      await updateDoc(chatRef, {
        [`clearedTimestamps.${currentUserId}`]: Date.now()
      });
      Alert.alert("Success", "Chat history cleared.");
    } catch (error) {
      console.error("Error clearing history: ", error);
    }
  };

  // BLOCK USER: Drops a record in global block registry, locks inputs, but leaves room visible
  const executeBlockWithParams = async (targetPeerId) => {
    if (!targetPeerId || !currentUserId) return;
    try {
      const blockId = `${currentUserId}_${targetPeerId}`;
      await setDoc(doc(db, 'blocks', blockId), {
        blockerId: currentUserId,
        blockedId: targetPeerId,
        createdAt: Date.now()
      });
      Alert.alert("Blocked", "User has been blocked. You will no longer see each other's marketplace feeds.");
    } catch (error) {
      Alert.alert("Database Error", error.message);
    }
  };

  // UNBLOCK USER: Deletes block document registry state clean
  const executeUnblock = async (targetPeerId) => {
    if (!targetPeerId || !currentUserId) return;
    try {
      const blockId = `${currentUserId}_${targetPeerId}`;
      await deleteDoc(doc(db, 'blocks', blockId));
      Alert.alert("Success", "User has been unblocked.");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  // Look up trading peer handle profiles
  useEffect(() => {
    const fetchPeerHandle = async () => {
      if (!peerId) return;
      try {
        const peerDocRef = doc(db, 'username', peerId);
        const docSnap = await getDoc(peerDocRef);
        if (docSnap.exists() && docSnap.data().username) {
          setPeerHandle(docSnap.data().username);
        }
      } catch (err) {
        console.log("Error looking up peer handle: ", err);
      }
    };
    fetchPeerHandle();
  }, [peerId]);

  // Real-time multi-layered snapshot subscriber messaging pipeline
  useEffect(() => {
    if (!chatId) return;

    const chatRef = doc(db, 'chats', chatId);
    let clearThreshold = 0;

    const unsubscribeChat = onSnapshot(chatRef, (chatSnap) => {
      if (chatSnap.exists()) {
        const data = chatSnap.data();
        clearThreshold = data.clearedTimestamps?.[currentUserId] || 0;
      }
    });

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const loadedBubbles = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        // Filter out bubbles created prior to local user clear commands
        .filter(msg => {
          const msgTime = msg.createdAt?.toMillis ? msg.createdAt.toMillis() : (msg.createdAt || Date.now());
          return msgTime > clearThreshold;
        });
      setMessages(loadedBubbles);
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [chatId, currentUserId]);

  const handleSendMessage = async () => {
    const cleanMsg = inputText.trim();
    if (!cleanMsg || !chatId || !peerId) return;

    try {
      const blockCheckId1 = `${currentUserId}_${peerId}`;
      const blockCheckId2 = `${peerId}_${currentUserId}`;
      
      const snap1 = await getDoc(doc(db, 'blocks', blockCheckId1));
      const snap2 = await getDoc(doc(db, 'blocks', blockCheckId2));

      if ((snap1.exists() && Object.keys(snap1.data() || {}).length > 0) || 
          (snap2.exists() && Object.keys(snap2.data() || {}).length > 0)) {
        Alert.alert("Action Blocked", "You cannot exchange messages with this student channel.");
        return;
      }

      setInputText('');
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUserId,
        text: cleanMsg,
        createdAt: serverTimestamp(),
      });

      const chatRoomDocRef = doc(db, 'chats', chatId);
      await updateDoc(chatRoomDocRef, {
        lastMessageText: cleanMsg,
        lastMessageTimestamp: Date.now(),
      });

    } catch (error) {
      console.error("Message write error: ", error);
    }
  };

  const renderMessageBubble = ({ item }) => {
    const isSenderMe = item.senderId === currentUserId;

    return (
      <View style={[styles.rowContainer, isSenderMe ? styles.myRow : styles.theirRow]}>
        <View style={[styles.bubbleBlock, isSenderMe ? styles.myBubble : styles.theirBubble]}>
          <Text style={isSenderMe ? styles.myBubbleText : styles.theirBubbleText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  if (!chatId) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.fallbackText}>Select a discussion room thread from your Inbox tab to view context.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.contextInfoBar}>
        <Text style={styles.contextInfoText}>
          📦 Regarding: <Text style={styles.contextItemBold}>{itemTitle}</Text>
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageBubble}
        inverted={true} 
        contentContainerStyle={styles.scrollListPadding}
        showsVerticalScrollIndicator={false}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputActionRow}>
          <TextInput
            style={[styles.textInputBox, isPeerBlocked && { backgroundColor: '#f0f0f5', color: '#8e8e93' }]}
            placeholder={isPeerBlocked ? "You have blocked this user" : "Suggest a meeting hub or timeline..."}
            placeholderTextColor="#a0a0a0"
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!isPeerBlocked}
          />
          <TouchableOpacity 
            style={[styles.dispatchButton, isPeerBlocked && { backgroundColor: '#cccccc' }]} 
            onPress={handleSendMessage} 
            disabled={isPeerBlocked}
            activeOpacity={0.8}
          >
            <Text style={styles.dispatchButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', padding: 20 },
  fallbackText: { color: '#8e8e93', fontSize: 15, textAlign: 'center' },
  headerMenuButton: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  headerMenuText: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },
  contextInfoBar: { 
    backgroundColor: '#f0f0f5', 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e5ea',
    alignItems: 'center'
  },
  contextInfoText: { fontSize: 13, color: '#636366' },
  contextItemBold: { fontWeight: 'bold', color: '#14004c' },
  scrollListPadding: { paddingHorizontal: 16, paddingVertical: 16 },
  rowContainer: { width: '100%', marginVertical: 5, flexDirection: 'row' },
  myRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubbleBlock: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  myBubble: { backgroundColor: '#14004c', borderBottomRightRadius: 4 },
  myBubbleText: { color: '#ffffff', fontSize: 16, lineHeight: 22 },
  theirBubble: { backgroundColor: '#f0f0f5', borderBottomLeftRadius: 4 },
  theirBubbleText: { color: '#14004c', fontSize: 16, lineHeight: 22 },
  inputActionRow: { 
    flexDirection: 'row', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    alignItems: 'center', 
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5ea'
  },
  textInputBox: { 
    flex: 1, 
    backgroundColor: '#fafafa', 
    color: '#222222', 
    borderRadius: 22, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    fontSize: 16, 
    maxHeight: 90,
    borderWidth: 1.5,
    borderColor: '#e0e0e0'
  },
  dispatchButton: { marginLeft: 14, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#14004c', borderRadius: 20 },
  dispatchButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 }
});