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
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { db, auth } from '../firebaseConfig';
import {
  collection,
  doc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  setDoc,
  deleteDoc,
  where,
  getDocs
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

  const [chatInfo, setChatInfo] = useState(null);
  const [transactionExists, setTransactionExists] = useState(false);
  const [activeTxId, setActiveTxId] = useState(null);
  const [txStatus, setTxStatus] = useState(null); // Will track 'pending', 'returned', or 'completed'
  const [checkingTransaction, setCheckingTransaction] = useState(true);

  // Rating Modal States
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);

  const paramsRef = useRef({ chatId: null, peerId: null });

  useEffect(() => {
    paramsRef.current = { chatId, peerId };
  }, [chatId, peerId]);

  useEffect(() => {
    if (!currentUserId || !peerId) return;
    const blockId = `${currentUserId}_${peerId}`;
    const unsubscribe = onSnapshot(doc(db, 'blocks', blockId), (docSnap) => {
      setIsPeerBlocked(docSnap.exists());
    });
    return () => unsubscribe();
  }, [currentUserId, peerId]);

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

  const executeClearHistory = async (targetId) => {
    if (!targetId) return;
    try {
      await updateDoc(doc(db, 'chats', targetId), { [`clearedTimestamps.${currentUserId}`]: Date.now() });
      Alert.alert("Success", "Chat history cleared.");
    } catch (error) {
      console.error(error);
    }
  };

  const executeBlockWithParams = async (targetPeerId) => {
    if (!targetPeerId || !currentUserId) return;
    try {
      await setDoc(doc(db, 'blocks', `${currentUserId}_${targetPeerId}`), { blockerId: currentUserId, blockedId: targetPeerId, createdAt: Date.now() });
      Alert.alert("Blocked", "User has been blocked.");
    } catch (error) {
      console.error(error);
    }
  };

  const executeUnblock = async (targetPeerId) => {
    if (!targetPeerId || !currentUserId) return;
    try {
      await deleteDoc(doc(db, 'blocks', `${currentUserId}_${targetPeerId}`));
      Alert.alert("Success", "User has been unblocked.");
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const fetchPeerHandle = async () => {
      if (!peerId) return;
      const docSnap = await getDoc(doc(db, 'username', peerId));
      if (docSnap.exists() && docSnap.data().username) setPeerHandle(docSnap.data().username);
    };
    fetchPeerHandle();
  }, [peerId]);

  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, 'chats', chatId);
    let clearThreshold = 0;

    const unsubscribeChat = onSnapshot(chatRef, (chatSnap) => {
      if (chatSnap.exists()) clearThreshold = chatSnap.data().clearedTimestamps?.[currentUserId] || 0;
    });

    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(msg => {
          const msgTime = msg.createdAt?.toMillis ? msg.createdAt.toMillis() : (msg.createdAt || Date.now());
          return msgTime > clearThreshold;
        });
      setMessages(loaded);
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [chatId, currentUserId]);

  // 📡 FIXED: Tracks active vs completed entries historically to prevent state reset popping
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "transactions"), where("chatId", "==", chatId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeTx = snapshot.docs.find(doc => doc.data().status !== "completed");
      const completedTx = snapshot.docs.find(doc => doc.data().status === "completed");

      if (activeTx) {
        setTransactionExists(true);
        setActiveTxId(activeTx.id);
        setTxStatus(activeTx.data().status);
      } else if (completedTx) {
        setTransactionExists(true); // Keep locked to hide initial actions
        setActiveTxId(completedTx.id);
        setTxStatus("completed");
      } else {
        setTransactionExists(false);
        setActiveTxId(null);
        setTxStatus(null);
      }
      setCheckingTransaction(false);
    });
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    const unsubscribe = onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (snap.exists()) setChatInfo(snap.data());
    });
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    if (txStatus === "returned") {
      const checkRatingCollected = async () => {
        const docSnap = await getDoc(doc(db, "transactions", activeTxId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const hasRated = data[`hasRated_${currentUserId}`];
          if (!hasRated) {
            setRatingModalVisible(true);
          }
        }
      };
      checkRatingCollected();
    }
  }, [txStatus, activeTxId, currentUserId]);

  const handleFinalizeChoice = () => {
    Alert.alert("Finalize Partner Choice", "Lock in this transaction partner?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "chats", chatId), { status: "finalized" });
            const source = chatInfo.listingType === "request" ? "requests" : "listings";
            await updateDoc(doc(db, source, chatInfo.itemId), { status: "finalized" });
          } catch (err) {
            console.error(err);
          }
        }
      }
    ]);
  };

  const handleUndoFinalizeChoice = () => {
    Alert.alert("Undo Finalize Choice", "Unlock selection and send your post back to public feeds?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Undo",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "chats", chatId), { status: "active" });
            const source = chatInfo.listingType === "request" ? "requests" : "listings";
            await updateDoc(doc(db, source, chatInfo.itemId), { status: "active" });
            Alert.alert("Success", "Partner selection undone. Your post is now live again.");
          } catch (err) {
            console.error("Error reverting status flags:", err);
          }
        }
      }
    ]);
  };

  const startTransaction = async () => {
    try {
      let lenderId, borrowerId;
      if (chatInfo.listingType === "listing") {
        lenderId = chatInfo.ownerId;
        borrowerId = chatInfo.ownerId === currentUserId ? peerId : currentUserId;
      } else {
        borrowerId = chatInfo.ownerId;
        lenderId = chatInfo.ownerId === currentUserId ? peerId : currentUserId;
      }

      await addDoc(collection(db, "transactions"), {
        chatId,
        itemTitle,
        lenderId,
        borrowerId,
        ownerId: chatInfo.ownerId || currentUserId,
        listingType: chatInfo.listingType || "listing",
        status: "pending",
        createdAt: serverTimestamp()
      });
      Alert.alert("Transaction Started", "Handoff sequence initiated.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleProcessUserRating = async () => {
    try {
      const txRef = doc(db, "transactions", activeTxId);
      const peerDocRef = doc(db, "username", peerId);
      const peerSnap = await getDoc(peerDocRef);

      if (peerSnap.exists()) {
        const peerData = peerSnap.data();
        const currentSum = peerData.ratingSum || 0;
        const currentCount = peerData.ratingCount || 0;

        const newSum = currentSum + selectedRating;
        const newCount = currentCount + 1;
        const newAvg = newSum / newCount;

        await updateDoc(peerDocRef, {
          ratingSum: newSum,
          ratingCount: newCount,
          averageRating: newAvg
        });
      }

      await updateDoc(txRef, { [`hasRated_${currentUserId}`]: true });

      const freshTxSnap = await getDoc(txRef);
      if (freshTxSnap.exists()) {
        const freshData = freshTxSnap.data();
        if (freshData[`hasRated_${currentUserId}`] && freshData[`hasRated_${peerId}`]) {
          await updateDoc(txRef, { status: "completed" });
        }
      }

      setRatingModalVisible(false);
      Alert.alert("Thank you", "Your review has been securely saved.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleReturnProductAsset = () => {
    Alert.alert("Confirm Return", "Are you sure you have successfully handed back this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Returned",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "transactions", activeTxId), { status: "returned" });
            Alert.alert("Returned Registered", "Please submit your counterparty score card.");
          } catch (err) {
            console.error(err);
          }
        }
      }
    ]);
  };

  const handleSendMessage = async () => {
    const cleanMsg = inputText.trim();
    if (!cleanMsg || !chatId || !peerId) return;
    try {
      setInputText('');
      await addDoc(collection(db, 'chats', chatId, 'messages'), { senderId: currentUserId, text: cleanMsg, createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'chats', chatId), { lastMessageText: cleanMsg, lastMessageTimestamp: Date.now() });
    } catch (error) {
      console.error(error);
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

  const isPostOwner = chatInfo && currentUserId === chatInfo.ownerId;
  const isLender = chatInfo && (
    (chatInfo.listingType === "listing" && currentUserId === chatInfo.ownerId) ||
    (chatInfo.listingType === "request" && currentUserId !== chatInfo.ownerId)
  );
  const isBorrower = chatInfo && (
    (chatInfo.listingType === "request" && currentUserId === chatInfo.ownerId) ||
    (chatInfo.listingType === "listing" && currentUserId !== chatInfo.ownerId)
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      <Modal visible={ratingModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rate Your Experience</Text>
            <Text style={styles.modalSubtitle}>Please grade your transaction experience with @{peerHandle}:</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((num) => (
                <TouchableOpacity key={num} onPress={() => setSelectedRating(num)}>
                  <Text style={[styles.starItem, selectedRating >= num ? { color: '#ffb300' } : { color: '#e5e5ea' }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitReviewBtn} onPress={handleProcessUserRating}>
              <Text style={styles.submitReviewBtnText}>Submit Rating</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.contextInfoBar}>
        <Text style={styles.contextInfoText}>📦 Regarding: <Text style={styles.contextItemBold}>{itemTitle}</Text></Text>
      </View>

      <FlatList data={messages} keyExtractor={(item) => item.id} renderItem={renderMessageBubble} inverted={true} contentContainerStyle={styles.scrollListPadding} showsVerticalScrollIndicator={false} />

      {(!chatInfo || checkingTransaction) ? (
        <View style={{ height: 74, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="small" color="#14004c" /></View>
      ) : (
        <>
          {/* Finalize Button Conditions */}
          {!transactionExists && isPostOwner && txStatus !== "completed" && (
            chatInfo.status !== "finalized" ? (
              <TouchableOpacity style={styles.finalizeBtn} onPress={handleFinalizeChoice} activeOpacity={0.8}>
                <Text style={styles.finalizeBtnText}>🎯 Finalize Partner Choice</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.undoFinalizeBtn} onPress={handleUndoFinalizeChoice} activeOpacity={0.8}>
                <Text style={styles.undoFinalizeBtnText}>↩️ Undo Finalize Choice</Text>
              </TouchableOpacity>
            )
          )}

          {/* Start Transaction Button Conditions */}
          {!transactionExists && isLender && chatInfo.status === "finalized" && txStatus !== "completed" && (
            <TouchableOpacity style={styles.transactionBtn} onPress={startTransaction} activeOpacity={0.8}>
              <Text style={styles.transactionBtnText}>Start Transaction</Text>
            </TouchableOpacity>
          )}

          {/* Return Action Button Conditions */}
          {txStatus === "pending" && isBorrower && (
            <TouchableOpacity style={styles.returnBtn} onPress={handleReturnProductAsset} activeOpacity={0.8}>
              <Text style={styles.returnBtnText}>🔄 Confirm Item Return</Text>
            </TouchableOpacity>
          )}

          {/* Review Awaiting HUD Notification banner */}
          {txStatus === "returned" && (
            <View style={styles.waitingBanner}>
              <Text style={styles.waitingBannerText}>Awaiting Peer Reviews Submission...</Text>
            </View>
          )}

          {/* Deal Completed Banner */}
          {txStatus === "completed" && (
            <View style={styles.completedBanner}>
              <Text style={styles.completedBannerText}>✅ Deal Completed & Reviewed Successfully</Text>
            </View>
          )}
        </>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.inputActionRow}>
          <TextInput style={styles.textInputBox} placeholder="Suggest a meeting hub..." placeholderTextColor="#a0a0a0" value={inputText} onChangeText={setInputText} multiline />
          <TouchableOpacity style={styles.dispatchButton} onPress={handleSendMessage} activeOpacity={0.8}><Text style={styles.dispatchButtonText}>Send</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#ffffff' },
  contextInfoBar: { backgroundColor: '#f0f0f5', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5ea', alignItems: 'center' },
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
  finalizeBtn: { backgroundColor: "#2e2270", marginHorizontal: 15, marginTop: 15, padding: 15, borderRadius: 10, alignItems: "center" },
  finalizeBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  undoFinalizeBtn: { backgroundColor: "#ffffff", marginHorizontal: 15, marginTop: 15, padding: 15, borderRadius: 10, alignItems: "center", borderWidth: 2, borderColor: "#2e2270" },
  undoFinalizeBtnText: { color: "#2e2270", fontWeight: "bold", fontSize: 16 },
  transactionBtn: { backgroundColor: "#14004c", margin: 15, padding: 15, borderRadius: 10, alignItems: "center" },
  transactionBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  returnBtn: { backgroundColor: "#00875a", margin: 15, padding: 15, borderRadius: 10, alignItems: "center" },
  returnBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  waitingBanner: { backgroundColor: "#fff9e6", margin: 15, padding: 14, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ffb30050" },
  waitingBannerText: { color: "#b78103", fontWeight: "700" },
  completedBanner: { backgroundColor: "#f2f2f7", margin: 15, padding: 14, borderRadius: 10, alignItems: "center" },
  completedBannerText: { color: "#00875a", fontWeight: "700", fontSize: 15 },
  inputActionRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e5e5ea' },
  textInputBox: { flex: 1, backgroundColor: '#fafafa', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, maxHeight: 90, borderWidth: 1.5, borderColor: '#e0e0e0' },
  dispatchButton: { marginLeft: 14, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#14004c', borderRadius: 20 },
  dispatchButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  headerMenuButton: { paddingHorizontal: 16 },
  headerMenuText: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', width: '85%', borderRadius: 20, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#14004c', marginBottom: 10 },
  modalSubtitle: { fontSize: 14, color: '#636366', textAlign: 'center', marginBottom: 20 },
  starRow: { flexDirection: 'row', marginBottom: 24 },
  starItem: { fontSize: 42, marginHorizontal: 6 },
  submitReviewBtn: { backgroundColor: '#14004c', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitReviewBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});