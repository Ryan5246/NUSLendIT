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
  Modal,
  Image,
  TouchableWithoutFeedback,
  Keyboard,
  Share
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  deleteField
} from 'firebase/firestore';
import {
  cancelReturnReminder,
  scheduleReturnReminder,
} from '../utils/notifications';

const isValidExpoPushToken = (token) => {
  return (
    typeof token === 'string' &&
    (
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[')
    )
  );
};

const sendExpoPushMessage = async (message) => {
  const response = await fetch(
    'https://exp.host/--/api/v2/push/send',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    }
  );

  const responseData = await response.json();
  if (!response.ok) {
    console.error('Chat notification error:', responseData);
  }
};

export default function ChatScreen({ route, navigation }) {
  const chatId = route.params?.chatId || route.params?.params?.chatId;
  const itemTitle = route.params?.itemTitle || route.params?.params?.itemTitle || 'Item';
  const peerId = route.params?.peerId || route.params?.params?.peerId;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [peerHandle, setPeerHandle] = useState('Campus Peer');
  const [peerRating, setPeerRating] = useState(null);
  const [isPeerBlocked, setIsPeerBlocked] = useState(false);
  const currentUserId = auth.currentUser?.uid;

  const [chatInfo, setChatInfo] = useState(null);
  const [transactionExists, setTransactionExists] = useState(false);
  const [activeTxId, setActiveTxId] = useState(null);
  const [txStatus, setTxStatus] = useState(null);
  const [initialHandoffCompleted, setInitialHandoffCompleted] = useState(false);
  const [checkingTransaction, setCheckingTransaction] = useState(true);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [fullScreenImageUri, setFullScreenImageUri] = useState(null);

  const [otpVerifyModalVisible, setOtpVerifyModalVisible] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [expectedOtp, setExpectedOtp] = useState('');
  const [otpTimestamp, setOtpTimestamp] = useState(null);
  const [timeLeft, setTimeLeft] = useState(180);

  const paramsRef = useRef({ chatId: null, peerId: null });

  useEffect(() => {
    paramsRef.current = { chatId, peerId };
  }, [chatId, peerId]);

  useEffect(() => {
    if (!chatId || !currentUserId) return;

    const markChatAsRead = async () => {
      try {
        await updateDoc(doc(db, 'chats', chatId), {
          [`readTimestamps.${currentUserId}`]: Date.now()
        });
      } catch (error) {
        console.error('Could not mark chat as read:', error);
      }
    };

    markChatAsRead();
    const unsubscribeFocus = navigation.addListener('focus', markChatAsRead);
    return unsubscribeFocus;
  }, [navigation, chatId, currentUserId]);

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
      headerTitle: () => (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 16 }}>
            @{peerHandle} {peerRating ? `⭐ ${peerRating}` : ''}
          </Text>
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerMenuButton}
          onPress={() => {
            const activeChatId = paramsRef.current.chatId;
            const activePeerId = paramsRef.current.peerId;
            const options = [
              { text: "Cancel", style: "cancel" },
              { text: "Clear Chat History", style: "destructive", onPress: () => executeClearHistory(activeChatId) },
              { text: "Report User", style: "destructive", onPress: () => setReportModalVisible(true) }
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
  }, [navigation, isPeerBlocked, peerHandle, peerRating]);

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

  const handleDeleteSingleMessage = (messageId) => {
    Alert.alert(
      "Unsend Message",
      "This message will be replaced with 'Message deleted' for everyone in the chat.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unsend",
          style: "destructive",
          onPress: async () => {
            try {
              const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
              await updateDoc(msgRef, {
                text: "Message deleted",
                imageUrl: deleteField(),
                isDeleted: true
              });

              await updateDoc(doc(db, 'chats', chatId), {
                lastMessageText: "Message deleted",
                lastMessageTimestamp: Date.now()
              });
            } catch (error) {
              console.error("Error unsending message:", error);
              Alert.alert("Error", "Could not unsend message.");
            }
          }
        }
      ]
    );
  };

  const handleSubmitReport = async () => {
    const cleanReason = reportReason.trim();
    if (!cleanReason) {
      Alert.alert("Reason Required", "Please provide a brief reason for reporting this user.");
      return;
    }

    Keyboard.dismiss();
    setSubmittingReport(true);

    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUserId,
        reportedUserId: peerId,
        chatId: chatId,
        itemTitle: itemTitle,
        reason: cleanReason,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setSubmittingReport(false);
      setReportModalVisible(false);
      setReportReason('');
      Alert.alert("Report Submitted", "Thank you. Our moderation team will review this incident.");
    } catch (error) {
      setSubmittingReport(false);
      Alert.alert("Error", "Could not submit report. Please try again.");
    }
  };

  const handlePickImage = async () => {
    if (isPeerBlocked) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Camera roll permissions are required to share photos.");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });

    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
      return;
    }

    const selectedAsset = pickerResult.assets[0];
    const imageUri = `data:image/jpeg;base64,${selectedAsset.base64}`;

    setUploadingImage(true);
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUserId,
        imageUrl: imageUri,
        text: '📷 Photo',
        createdAt: serverTimestamp(),
      });

      const sentAt = Date.now();
      const chatRoomDocRef = doc(db, 'chats', chatId);
      await updateDoc(chatRoomDocRef, {
        lastMessageText: '📷 Photo',
        lastMessageTimestamp: sentAt,
        lastMessageSenderId: currentUserId,
        [`readTimestamps.${currentUserId}`]: sentAt
      });

      setUploadingImage(false);
    } catch (error) {
      console.error("Error sending image:", error);
      setUploadingImage(false);
      Alert.alert("Upload Failed", "Could not send the image.");
    }
  };

  const handleSaveOrShareImage = async (imageUri) => {
    try {
      await Share.share({
        url: imageUri,
        title: 'Shared Image'
      });
    } catch (error) {
      Alert.alert("Error", "Could not share or download image.");
    }
  };

  useEffect(() => {
    const fetchPeerData = async () => {
      if (!peerId) return;
      try {
        const docSnap = await getDoc(doc(db, 'username', peerId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.username) setPeerHandle(data.username);
          const rawRating = data.averageRating || data.rating || data.stars;
          if (rawRating) setPeerRating(Number(rawRating).toFixed(1));
        }
      } catch (err) {
        console.error("Error fetching peer data: ", err);
      }
    };
    fetchPeerData();
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

      if (
        navigation.isFocused() &&
        loaded[0]?.senderId &&
        loaded[0].senderId !== currentUserId
      ) {
        updateDoc(doc(db, 'chats', chatId), {
          [`readTimestamps.${currentUserId}`]: Date.now()
        }).catch(error =>
          console.error('Could not update chat read state:', error)
        );
      }
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [navigation, chatId, currentUserId]);

  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "transactions"), where("chatId", "==", chatId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeTx = snapshot.docs.find(doc => doc.data().status !== "completed");
      const completedTx = snapshot.docs.find(doc => doc.data().status === "completed");

      if (activeTx) {
        const txData = activeTx.data();
        setTransactionExists(true);
        setActiveTxId(activeTx.id);
        setTxStatus(txData.status);
        setExpectedOtp(txData.otp || '');
        setOtpTimestamp(txData.otpCreatedAt || null);
        setInitialHandoffCompleted(
          Boolean(txData.borrowedAt) ||
          ["pending", "returning", "returned"].includes(txData.status)
        );

        if (txData.status === "verifying" && isBorrower) {
          setOtpVerifyModalVisible(true);
        } else if (txData.status === "returning" && isLender) {
          setOtpVerifyModalVisible(true);
        } else {
          setOtpVerifyModalVisible(false);
        }
      } else if (completedTx) {
        setTransactionExists(true);
        setActiveTxId(completedTx.id);
        setTxStatus("completed");
        setOtpVerifyModalVisible(false);
        setOtpTimestamp(null);
        setInitialHandoffCompleted(true);
      } else {
        setTransactionExists(false);
        setActiveTxId(null);
        setTxStatus(null);
        setOtpVerifyModalVisible(false);
        setOtpTimestamp(null);
        setInitialHandoffCompleted(false);
      }
      setCheckingTransaction(false);
    });
    return () => unsubscribe();
  }, [chatId, chatInfo]);

  useEffect(() => {
    if (!otpTimestamp || !activeTxId || (txStatus !== "verifying" && txStatus !== "returning")) return;

    const trackingInterval = setInterval(async () => {
      const timePassedMs = Date.now() - otpTimestamp;
      const remainingSecs = Math.max(0, Math.floor((180000 - timePassedMs) / 1000));
      setTimeLeft(remainingSecs);

      if (remainingSecs <= 0) {
        clearInterval(trackingInterval);
        setOtpVerifyModalVisible(false);
        setEnteredOtp('');

        try {
          if (txStatus === "verifying") {
            await deleteDoc(doc(db, "transactions", activeTxId));
            Alert.alert("Token Expired", "The 3-minute validation limit has passed. Please re-generate a new code.");
          } else if (txStatus === "returning") {
            await updateDoc(doc(db, "transactions", activeTxId), {
              status: "pending",
              otp: "",
              otpCreatedAt: null
            });
            Alert.alert("Return Token Expired", "The return token expired. Please ask the borrower to generate a fresh return code.");
          }
        } catch (err) {
          console.error("Error breaking expired cycle: ", err);
        }
      }
    }, 1000);

    return () => clearInterval(trackingInterval);
  }, [otpTimestamp, activeTxId, txStatus]);

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
          if (!data[`hasRated_${currentUserId}`]) {
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
      let lenderId;
      let borrowerId;

      if (chatInfo.listingType === "listing") {
        lenderId = chatInfo.ownerId;
        borrowerId = chatInfo.ownerId === currentUserId ? peerId : currentUserId;
      } else {
        borrowerId = chatInfo.ownerId;
        lenderId = chatInfo.ownerId === currentUserId ? peerId : currentUserId;
      }

      const sourceCollection = chatInfo.listingType === "request" ? "requests" : "listings";
      const postSnapshot = await getDoc(doc(db, sourceCollection, chatInfo.itemId));

      if (!postSnapshot.exists()) {
        Alert.alert("Error", "The original post could not be found.");
        return;
      }

      const postData = postSnapshot.data();
      if (!postData.returnDateTimestamp) {
        Alert.alert("Return Date Missing", "This post does not have a valid return date.");
        return;
      }

      const securityPinCode = Math.floor(100000 + Math.random() * 900000).toString();

      await addDoc(collection(db, "transactions"), {
        chatId,
        itemTitle,
        lenderId,
        borrowerId,
        ownerId: chatInfo.ownerId || currentUserId,
        listingType: chatInfo.listingType || "listing",
        returnDateTimestamp: postData.returnDateTimestamp,
        status: "verifying",
        otp: securityPinCode,
        otpCreatedAt: Date.now(),
        createdAt: serverTimestamp()
      });

      Alert.alert(
        "🔑 Handoff Token Generated",
        `Give this verification code to the borrower when you meet up: ${securityPinCode}\n\nValid for 3 minutes.`,
        [{ text: "OK" }]
      );
    } catch (err) {
      console.error("Start transaction error:", err);
      Alert.alert("Error", "Could not start the transaction.");
    }
  };

  const handleVerifyOtpToken = async () => {
    if (Date.now() - otpTimestamp > 180000) {
      return Alert.alert("Expired", "This code has run out of time. Please generate a new one.");
    }

    if (enteredOtp.trim() === expectedOtp) {
      try {
        if (txStatus === "verifying") {
          const activeTransactionSnapshot = await getDoc(doc(db, "transactions", activeTxId));
          const activeTransaction = activeTransactionSnapshot.data();
          const returnDate = activeTransaction?.returnDateTimestamp?.toDate();

          if (!returnDate) {
            Alert.alert("Return Date Missing", "This transaction does not have a valid return date.");
            return;
          }

          const returnReminderNotificationId = await scheduleReturnReminder({
            transactionId: activeTxId,
            itemTitle: activeTransaction.itemTitle || itemTitle,
            returnDate,
            chatId,
            peerId,
            peerUsername: peerHandle,
          });

          await updateDoc(doc(db, "transactions", activeTxId), {
            status: "pending",
            otp: "",
            otpCreatedAt: null,
            borrowedAt: serverTimestamp(),
            returnReminderNotificationId: returnReminderNotificationId || null,
            returnReminderScheduledAt: returnReminderNotificationId ? serverTimestamp() : null,
          });
          setOtpVerifyModalVisible(false);
          setEnteredOtp('');
          Alert.alert("Success", "Handoff verified! The item is now out on loan.");
        } else if (txStatus === "returning") {
          const activeTransactionSnapshot = await getDoc(doc(db, "transactions", activeTxId));
          await cancelReturnReminder(activeTransactionSnapshot.data()?.returnReminderNotificationId);

          await updateDoc(doc(db, "transactions", activeTxId), {
            status: "returned",
            otp: "",
            otpCreatedAt: null
          });
          setOtpVerifyModalVisible(false);
          setEnteredOtp('');
          Alert.alert("Success", "Item return verified! Please rate your experience.");
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      Alert.alert("Invalid Code", "The token you entered does not match the generated secure signature.");
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
    Alert.alert("Initiate Return", "Are you ready to return this item and generate a verification code?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Generate Return Code",
        onPress: async () => {
          try {
            const returnPinCode = Math.floor(100000 + Math.random() * 900000).toString();
            await updateDoc(doc(db, "transactions", activeTxId), {
              status: "returning",
              otp: returnPinCode,
              otpCreatedAt: Date.now()
            });

            Alert.alert(
              "🔑 Return Token Generated",
              `Show this verification code to the lender so they can confirm the return: ${returnPinCode}\n\nValid for 3 minutes.`,
              [{ text: "OK" }]
            );
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
      await addDoc(collection(db, 'chats', chatId, 'messages'), { senderId: currentUserId, text: cleanMsg, createdAt: serverTimestamp() });
      const sentAt = Date.now();
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessageText: cleanMsg,
        lastMessageTimestamp: sentAt,
        lastMessageSenderId: currentUserId,
        [`readTimestamps.${currentUserId}`]: sentAt
      });

      const recipientProfileSnapshot = await getDoc(doc(db, 'username', peerId));
      const recipientProfile = recipientProfileSnapshot.exists() ? recipientProfileSnapshot.data() : null;
      const recipientPushToken = recipientProfile?.expoPushToken;

      if (isValidExpoPushToken(recipientPushToken)) {
        const senderProfileSnapshot = await getDoc(doc(db, 'username', currentUserId));
        const senderProfile = senderProfileSnapshot.exists() ? senderProfileSnapshot.data() : null;

        await sendExpoPushMessage({
          to: recipientPushToken,
          sound: 'default',
          priority: 'high',
          channelId: 'chat-messages',
          title: `New message from @${senderProfile?.username || 'student'}`,
          body: cleanMsg,
          data: {
            type: 'chat_message',
            chatId,
            peerId: currentUserId,
            peerUsername: senderProfile?.username || 'student',
            itemTitle
          }
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const renderMessageBubble = ({ item }) => {
    const isSenderMe = item.senderId === currentUserId;
    const isDeleted = item.isDeleted || item.text === "Message deleted";

    const handleAction = () => {
      if (isDeleted) return;
      if (item.imageUrl) {
        setFullScreenImageUri(item.imageUrl);
      } else if (isSenderMe) {
        handleDeleteSingleMessage(item.id);
      }
    };

    return (
      <View style={[styles.rowContainer, isSenderMe ? styles.myRow : styles.theirRow]}>
        <TouchableOpacity
          activeOpacity={isDeleted ? 1 : 0.7}
          delayLongPress={200}
          onLongPress={() => {
            if (isSenderMe && !isDeleted) {
              handleDeleteSingleMessage(item.id);
            }
          }}
          onPress={handleAction}
          style={[
            styles.bubbleBlock,
            isSenderMe ? styles.myBubble : styles.theirBubble,
            item.imageUrl && !isDeleted && styles.imageBubbleBlock,
            isDeleted && styles.deletedBubble
          ]}
        >
          {item.imageUrl && !isDeleted ? (
            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
          ) : (
            <Text
              style={[
                isSenderMe ? styles.myBubbleText : styles.theirBubbleText,
                isDeleted && styles.deletedBubbleText
              ]}
            >
              {isDeleted ? "Message deleted" : item.text}
            </Text>
          )}
        </TouchableOpacity>
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

      <Modal visible={reportModalVisible} animationType="slide" transparent={true}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback accessible={false}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Report User</Text>
                <Text style={styles.modalSubtitle}>
                  Help us keep the community safe. Why are you reporting @{peerHandle}?
                </Text>

                <TextInput
                  style={styles.reportInputBox}
                  placeholder="Describe the issue (e.g. spam, inappropriate messages, scam...)"
                  placeholderTextColor="#a0a0a0"
                  value={reportReason}
                  onChangeText={setReportReason}
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      setReportModalVisible(false);
                      setReportReason('');
                    }}
                    disabled={submittingReport}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.submitReportBtn}
                    onPress={handleSubmitReport}
                    disabled={submittingReport}
                  >
                    {submittingReport ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.submitReportBtnText}>Submit Report</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={!!fullScreenImageUri} animationType="fade" transparent={true}>
        <View style={styles.fullScreenModalOverlay}>
          <TouchableOpacity
            style={styles.closeFullScreenBtn}
            onPress={() => setFullScreenImageUri(null)}
          >
            <Text style={styles.closeFullScreenBtnText}>✕ Close</Text>
          </TouchableOpacity>

          {fullScreenImageUri && (
            <Image
              source={{ uri: fullScreenImageUri }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}

          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={() => handleSaveOrShareImage(fullScreenImageUri)}
          >
            <Text style={styles.downloadBtnText}>📥 Save / Share Image</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={otpVerifyModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔐 Verify Exchange</Text>
            <Text style={styles.modalSubtitle}>
              {txStatus === "verifying"
                ? "Please input the 6-digit verification code generated on the lender's device screen:"
                : "Please input the 6-digit verification code generated on the borrower's device screen:"}
            </Text>

            <TextInput
              style={styles.otpInputBox}
              placeholder="000000"
              placeholderTextColor="#a0a0a0"
              keyboardType="number-pad"
              maxLength={6}
              value={enteredOtp}
              onChangeText={setEnteredOtp}
              textAlign="center"
            />

            <Text style={[styles.timerCountdownText, timeLeft < 30 && { color: '#ff3b30' }]}>
              ⏳ Code expires in: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </Text>

            <TouchableOpacity style={styles.submitReviewBtn} onPress={handleVerifyOtpToken}>
              <Text style={styles.submitReviewBtnText}>Confirm Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
          {txStatus !== "verifying" && txStatus !== "returning" && txStatus !== "returned" && txStatus !== "completed" && isPostOwner && (chatInfo.status !== "finalized" || !initialHandoffCompleted) && (
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

          {!transactionExists && isLender && chatInfo.status === "finalized" && (
            <TouchableOpacity style={styles.transactionBtn} onPress={startTransaction} activeOpacity={0.8}>
              <Text style={styles.transactionBtnText}>Start Transaction</Text>
            </TouchableOpacity>
          )}

          {txStatus === "verifying" && isLender && (
            <TouchableOpacity style={styles.waitingBanner} onPress={() => Alert.alert("🔑 Code Reminder", `Provide this code to the borrower: ${expectedOtp}`)}>
              <Text style={[styles.waitingBannerText, { color: '#14004c' }]}>🔑 Code: {expectedOtp} ({timeLeft}s left)</Text>
            </TouchableOpacity>
          )}

          {txStatus === "pending" && isBorrower && (
            <TouchableOpacity style={styles.returnBtn} onPress={handleReturnProductAsset} activeOpacity={0.8}>
              <Text style={styles.returnBtnText}>🔄 Confirm Item Return</Text>
            </TouchableOpacity>
          )}

          {txStatus === "returning" && isBorrower && (
            <TouchableOpacity style={styles.waitingBanner} onPress={() => Alert.alert("🔑 Code Reminder", `Provide this return code to the lender: ${expectedOtp}`)}>
              <Text style={[styles.waitingBannerText, { color: '#00875a' }]}>🔑 Return Code: {expectedOtp} ({timeLeft}s left)</Text>
            </TouchableOpacity>
          )}

          {txStatus === "returning" && isLender && (
            <TouchableOpacity style={[styles.waitingBanner, { backgroundColor: '#e6f4ea', borderColor: '#34a85350' }]} onPress={() => setOtpVerifyModalVisible(true)}>
              <Text style={[styles.waitingBannerText, { color: '#137333' }]}>🔒 Borrower Returning Item! Tap to Enter Code ({timeLeft}s left)</Text>
            </TouchableOpacity>
          )}

          {txStatus === "returned" && (
            <View style={styles.waitingBanner}>
              <Text style={styles.waitingBannerText}>Awaiting Peer Reviews Submission...</Text>
            </View>
          )}

          {txStatus === "completed" && (
            <View style={styles.completedBanner}>
              <Text style={styles.completedBannerText}>✅ Deal Completed & Reviewed Successfully</Text>
            </View>
          )}
        </>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.inputActionRow}>
          <TouchableOpacity
            style={styles.imagePickerBtn}
            onPress={handlePickImage}
            disabled={isPeerBlocked || uploadingImage}
          >
            {uploadingImage ? (
              <ActivityIndicator color="#14004c" size="small" />
            ) : (
              <Text style={styles.imagePickerBtnIcon}>📷</Text>
            )}
          </TouchableOpacity>

          <TextInput
            style={[styles.textInputBox, isPeerBlocked && { backgroundColor: '#f0f0f5', color: '#8e8e93' }]}
            placeholder={isPeerBlocked ? "You have blocked this user" : "Suggest a meeting hub..."}
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
  contextInfoBar: { backgroundColor: '#f0f0f5', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5ea', alignItems: 'center' },
  contextInfoText: { fontSize: 13, color: '#636366' },
  contextItemBold: { fontWeight: 'bold', color: '#14004c' },
  scrollListPadding: { paddingHorizontal: 16, paddingVertical: 16 },
  rowContainer: { width: '100%', marginVertical: 5, flexDirection: 'row' },
  myRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubbleBlock: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  imageBubbleBlock: { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden', borderRadius: 16 },
  myBubble: { backgroundColor: '#14004c', borderBottomRightRadius: 4 },
  myBubbleText: { color: '#ffffff', fontSize: 16, lineHeight: 22 },
  theirBubble: { backgroundColor: '#f0f0f5', borderBottomLeftRadius: 4 },
  theirBubbleText: { color: '#14004c', fontSize: 16, lineHeight: 22 },
  deletedBubble: { backgroundColor: '#f0f0f5', borderWidth: 1, borderColor: '#e5e5ea' },
  deletedBubbleText: { color: '#8e8e93', fontStyle: 'italic', fontSize: 14 },
  messageImage: { width: 220, height: 200, borderRadius: 16, resizeMode: 'cover' },
  finalizeBtn: { backgroundColor: "#2e2270", marginHorizontal: 15, marginTop: 15, padding: 15, borderRadius: 10, alignItems: "center" },
  finalizeBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  undoFinalizeBtn: { backgroundColor: "#ffffff", marginHorizontal: 15, marginTop: 15, padding: 15, borderRadius: 10, alignItems: "center", borderWidth: 2, borderColor: "#2e2270" },
  undoFinalizeBtnText: { color: "#2e2270", fontWeight: "bold", fontSize: 16 },
  transactionBtn: { backgroundColor: "#14004c", margin: 15, padding: 15, borderRadius: 10, alignItems: "center" },
  transactionBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  returnBtn: { backgroundColor: "#00875a", margin: 15, padding: 15, borderRadius: 10, alignItems: "center" },
  returnBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  waitingBanner: { backgroundColor: "#fff9e6", margin: 15, padding: 14, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ffb30050" },
  waitingBannerText: { color: "#b78103", fontWeight: "700", textAlign: 'center' },
  completedBanner: { backgroundColor: "#f2f2f7", margin: 15, padding: 14, borderRadius: 10, alignItems: "center" },
  completedBannerText: { color: "#00875a", fontWeight: "700", fontSize: 15 },
  inputActionRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e5e5ea' },
  imagePickerBtn: { paddingHorizontal: 8, paddingVertical: 8, marginRight: 6, justifyContent: 'center', alignItems: 'center' },
  imagePickerBtnIcon: { fontSize: 22 },
  textInputBox: { flex: 1, backgroundColor: '#fafafa', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, maxHeight: 90, borderWidth: 1.5, borderColor: '#e0e0e0' },
  dispatchButton: { marginLeft: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#14004c', borderRadius: 20 },
  dispatchButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  headerMenuButton: { paddingHorizontal: 16 },
  headerMenuText: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', width: '85%', borderRadius: 20, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#14004c', marginBottom: 10 },
  modalSubtitle: { fontSize: 14, color: '#636366', textAlign: 'center', marginBottom: 20 },
  reportInputBox: { width: '100%', height: 100, backgroundColor: '#f8f8fc', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e5ea', padding: 12, fontSize: 14, color: '#222222', marginBottom: 20 },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e5ea', alignItems: 'center', marginRight: 8 },
  cancelBtnText: { color: '#636366', fontWeight: 'bold', fontSize: 15 },
  submitReportBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#ff3b30', alignItems: 'center', marginLeft: 8 },
  submitReportBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  fullScreenModalOverlay: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  closeFullScreenBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  closeFullScreenBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  fullScreenImage: { width: '100%', height: '75%' },
  downloadBtn: { position: 'absolute', bottom: 40, backgroundColor: '#14004c', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  downloadBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  starRow: { flexDirection: 'row', marginBottom: 24 },
  starItem: { fontSize: 42, marginHorizontal: 6 },
  submitReviewBtn: { backgroundColor: '#14004c', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitReviewBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  otpInputBox: { width: '80%', height: 54, borderWidth: 2, borderColor: '#14004c', borderRadius: 12, fontSize: 24, fontWeight: 'bold', letterSpacing: 4, color: '#14004c', backgroundColor: '#f2f2f7', marginBottom: 12 },
  timerCountdownText: { fontSize: 13, fontWeight: '600', color: '#8e8e93', marginBottom: 20 }
});