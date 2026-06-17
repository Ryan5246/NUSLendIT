import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Alert
} from 'react-native';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, collection, query, orderBy, onSnapshot, getDocs, addDoc, where } from 'firebase/firestore';

export default function DashboardScreen({ navigation }) {
  const [username, setUsername] = useState('Student');
  const [loading, setLoading] = useState(true);
  
  const [peerBorrow, setPeerBorrow] = useState(null);
  const [peerLend, setPeerLend] = useState(null);

  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUserId) return;

    let unsubscribeBorrow = () => {};
    let unsubscribeLend = () => {};

    // Fetch current user's profile handle
    const fetchUserProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'username', currentUserId));
        if (docSnap.exists() && docSnap.data().username) {
          setUsername(docSnap.data().username);
        }
      } catch (err) {
        console.error("Error loading user profile: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();

    // BI-DIRECTIONAL BLOCK LISTENER: Track both blocker and blocked relationships
    const blocksQuery = query(collection(db, 'blocks'));
    
    const unsubscribeBlocks = onSnapshot(blocksQuery, (blocksSnapshot) => {
      const blockedUserIds = [];
      
      blocksSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.blockerId === currentUserId) {
          blockedUserIds.push(data.blockedId);
        } else if (data.blockedId === currentUserId) {
          blockedUserIds.push(data.blockerId);
        }
      });

      // Unsubscribe from old listeners before creating new ones to prevent leaks
      unsubscribeBorrow();
      unsubscribeLend();

      // Stream latest request posted by another student (excluding bidirectional blocks)
      const qBorrow = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
      unsubscribeBorrow = onSnapshot(qBorrow, (snapshot) => {
        const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const peerRequests = allDocs.filter(doc => 
          doc.userId !== currentUserId && !blockedUserIds.includes(doc.userId)
        );
        
        if (peerRequests.length > 0) {
          setPeerBorrow(peerRequests[0]);
        } else {
          setPeerBorrow(null);
        }
      });

      // Stream latest listing posted by another student (excluding bidirectional blocks)
      const qLend = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
      unsubscribeLend = onSnapshot(qLend, (snapshot) => {
        const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const peerListings = allDocs.filter(doc => 
          doc.userId !== currentUserId && !blockedUserIds.includes(doc.userId)
        );
        
        if (peerListings.length > 0) {
          setPeerLend(peerListings[0]);
        } else {
          setPeerLend(null);
        }
      });
    }, (error) => {
      console.error("Error loading block lists on Dashboard: ", error);
    });

    return () => {
      unsubscribeBlocks();
      unsubscribeBorrow();
      unsubscribeLend();
    };
  }, [currentUserId]);

  // Asynchronous Interceptor to handle room validation and routing
  const executeChatRouting = async (itemCard) => {
    const itemOwnerId = itemCard.userId;

    if (!itemOwnerId || itemOwnerId === 'anonymous_student') {
      Alert.alert("Invalid Listing", "Cannot initiate a negotiation channel with an unlinked student profile.");
      return;
    }

    try {
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('itemId', '==', itemCard.id));
      const querySnapshot = await getDocs(q);
      
      let targetChatId = null;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.participants?.includes(currentUserId) && data.participants?.includes(itemOwnerId)) {
          targetChatId = doc.id;
        }
      });

      if (!targetChatId) {
        const newChatRoom = {
          itemId: itemCard.id,
          itemTitle: itemCard.item,
          participants: [currentUserId, itemOwnerId],
          lastMessageText: 'Room created. Start negotiating handoff details!',
          lastMessageTimestamp: Date.now(),
        };
        const docRef = await addDoc(collection(db, 'chats'), newChatRoom);
        targetChatId = docRef.id;
      }

      navigation.navigate('Chat', {
        screen: 'ChatConversation',
        params: {
          chatId: targetChatId,
          itemTitle: itemCard.item,
          peerId: itemOwnerId,
          peerUsername: itemCard.username || 'unknown'
        }
      });

    } catch (error) {
      console.error("Chat setup failure: ", error);
      Alert.alert("Error", "Could not establish a secure chat session.");
    }
  };

  const handleTransactionInitiation = (item, type) => {
    if (type === 'Request') {
      Alert.alert(
        'Initiate Loan',
        `Would you like to offer your ${item.item} to this borrower? This will open a negotiation chat.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Chat', onPress: () => executeChatRouting(item) }
        ]
      );
    } else {
      Alert.alert(
        'Request Item',
        `Would you like to request a loan for this ${item.item}? This will notify the lender.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm Request', onPress: () => executeChatRouting(item) }
        ]
      );
    }
  };

  const handleSeeAllRequests = () => {
    navigation.navigate('Search', { initialTab: 'Request' });
  };

  const handleSeeAllListings = () => {
    navigation.navigate('Search', { initialTab: 'List' });
  };

  const handleOpenProfile = () => {
    alert("Profile screen integration coming up next!");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerSpinner}>
        <ActivityIndicator size="large" color="#14004c" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Welcome Header */}
        <View style={styles.welcomeHeader}>
          <View>
            <Text style={styles.greetingText}>Welcome back,</Text>
            <Text style={styles.usernameText}>@{username}</Text>
          </View>
          <TouchableOpacity style={styles.avatarButton} onPress={handleOpenProfile} activeOpacity={0.8}>
            <Image source={require('../assets/Logo1.png')} style={styles.avatarImage} />
          </TouchableOpacity>
        </View>

        {/* Peer Borrow Card */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Latest Request</Text>
            <TouchableOpacity onPress={handleSeeAllRequests}>
              <Text style={styles.seeAllText}>See All →</Text>
            </TouchableOpacity>
          </View>

          {peerBorrow ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  Need: {peerBorrow.item}{' '}
                  <Text style={styles.cardAuthor}>by @{peerBorrow.username || 'unknown'}</Text>
                </Text>
                <Text style={styles.cardPrice}>${peerBorrow.willingToPay}</Text>
              </View>
              <Text style={styles.cardRow}>📍 Location: <Text style={styles.cardValue}>{peerBorrow.location}</Text></Text>
              <Text style={styles.cardRow}>📅 Timeline: <Text style={styles.cardValue}>{peerBorrow.borrowdate} to {peerBorrow.returndate}</Text></Text>
              <Text style={styles.cardRow}>🏦 Security Deposit: <Text style={styles.cardValue}>${peerBorrow.deposit}</Text></Text>
              <Text style={styles.cardRow}>💬 Details: <Text style={styles.cardValue}>{peerBorrow.description}</Text></Text>

              <TouchableOpacity 
                style={styles.cardActionButton} 
                onPress={() => handleTransactionInitiation(peerBorrow, 'Request')} 
                activeOpacity={0.8}
              >
                <Text style={styles.cardActionButtonText}>Offer to Lend</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No peer borrow requests available on campus right now.</Text>
            </View>
          )}
        </View>

        {/* Peer Lend Card */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Latest Listing</Text>
            <TouchableOpacity onPress={handleSeeAllListings}>
              <Text style={styles.seeAllText}>See All →</Text>
            </TouchableOpacity>
          </View>

          {peerLend ? (
            <View style={[styles.card, styles.listingCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  Item: {peerLend.item}{' '}
                  <Text style={styles.cardAuthor}>by @{peerLend.username || 'unknown'}</Text>
                </Text>
                <Text style={styles.cardPrice}>${peerLend.costPerDay}/day</Text>
              </View>
              <Text style={styles.cardRow}>📍 Location: <Text style={styles.cardValue}>{peerLend.location}</Text></Text>
              <Text style={styles.cardRow}>🛡️ Security Deposit: <Text style={styles.cardValue}>{peerLend.deposit}</Text></Text>
              <Text style={styles.cardRow}>💬 Requirements: <Text style={styles.cardValue}>{peerLend.returnConditions}</Text></Text>

              <TouchableOpacity 
                style={[styles.cardActionButton, styles.listingActionButton]} 
                onPress={() => handleTransactionInitiation(peerLend, 'List')} 
                activeOpacity={0.8}
              >
                <Text style={styles.cardActionButtonText}>Request to Borrow</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No campus peer listings available at the moment.</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: { flex: 1, backgroundColor: '#ffffff' },
  centerSpinner: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  welcomeHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f5'
  },
  greetingText: { fontSize: 16, color: '#8e8e93', fontWeight: '500' },
  usernameText: { fontSize: 26, fontWeight: 'bold', color: '#14004c', marginTop: 2 },
  avatarButton: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#14004c', 
    justifyContent: 'center', 
    alignItems: 'center',
    overflow: 'hidden'
  },
  avatarImage: { width: '85%', height: '85%', resizeMode: 'contain', tintColor: '#ffffff' },
  sectionWrapper: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#14004c' },
  seeAllText: { fontSize: 14, fontWeight: '700', color: '#2e2270' },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    borderRadius: 20,
    padding: 18,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listingCard: { borderColor: '#2e227025' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 19, fontWeight: 'bold', color: '#14004c', flex: 1, paddingRight: 10 },
  cardAuthor: { fontSize: 14, fontWeight: 'normal', color: '#8e8e93' },
  cardPrice: { fontSize: 19, fontWeight: 'bold', color: '#14004c' },
  cardRow: { fontSize: 14, fontWeight: '700', color: '#555555', marginBottom: 6, lineHeight: 20 },
  cardValue: { fontWeight: '500', color: '#222222' },
  cardActionButton: {
    width: '100%',
    height: 44,
    backgroundColor: '#14004c',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  listingActionButton: { backgroundColor: '#2e2270' },
  cardActionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  emptyCard: { 
    backgroundColor: '#f8f8fa', 
    borderRadius: 16, 
    padding: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderStyle: 'dashed'
  },
  emptyCardText: { color: '#8e8e93', fontSize: 14, textAlign: 'center' }
});