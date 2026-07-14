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
  Alert,
  Modal,
  Dimensions
} from 'react-native';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, collection, query, orderBy, onSnapshot, getDocs, addDoc, where } from 'firebase/firestore';
import { getCampusLocationLabel } from './PostScreen'; 

const { width } = Dimensions.get('window');

function UserRatingBadge({ userId }) {
  const [ratingInfo, setRatingInfo] = useState({ avg: 0, count: 0 });

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onSnapshot(doc(db, 'username', userId), (userDoc) => {
      if (userDoc.exists()) {
        const data = userDoc.data();
        setRatingInfo({
          avg: data.averageRating !== undefined ? data.averageRating.toFixed(1) : 'New',
          count: data.ratingCount || 0
        });
      }
    }, (err) => console.log("Badge read error:", err));
    
    return () => unsubscribe();
  }, [userId]);

  return (
    <Text style={styles.ratingBadgeText}>
      ⭐ {ratingInfo.avg} {ratingInfo.count > 0 ? `(${ratingInfo.count})` : ''}
    </Text>
  );
}

export default function DashboardScreen({ navigation }) {
  const [username, setUsername] = useState('Student');
  const [userRating, setUserRating] = useState('New');
  const [userReviewsCount, setUserReviewsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  
  const [peerBorrow, setPeerBorrow] = useState(null);
  const [peerLend, setPeerLend] = useState(null);

  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUserId) return;

    let unsubscribeBorrow = () => { };
    let unsubscribeLend = () => { };

    const unsubscribeProfile = onSnapshot(doc(db, 'username', currentUserId), (docSnap) => {
      if (docSnap.exists()) {
        const uData = docSnap.data();
        if (uData.username) setUsername(uData.username);
        if (uData.averageRating !== undefined && uData.averageRating !== null) {
          setUserRating(uData.averageRating.toFixed(1));
        } else {
          setUserRating('New');
        }
        setUserReviewsCount(uData.ratingCount || 0);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

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

      unsubscribeBorrow();
      unsubscribeLend();

      const qBorrow = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
      unsubscribeBorrow = onSnapshot(qBorrow, (snapshot) => {
        const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const peerRequests = allDocs.filter(doc =>
          doc.userId !== currentUserId && 
          !blockedUserIds.includes(doc.userId) &&
          doc.status !== "finalized" &&
          doc.isDeleted !== true
        );
        setPeerBorrow(peerRequests.length > 0 ? peerRequests[0] : null);
      });

      const qLend = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
      unsubscribeLend = onSnapshot(qLend, (snapshot) => {
        const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const peerListings = allDocs.filter(doc =>
          doc.userId !== currentUserId && 
          !blockedUserIds.includes(doc.userId) &&
          doc.status !== "finalized" &&
          doc.isDeleted !== true
        );
        setPeerLend(peerListings.length > 0 ? peerListings[0] : null);
      });
    }, (error) => {
      console.error(error);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeBlocks();
      unsubscribeBorrow();
      unsubscribeLend();
    };
  }, [currentUserId]);

  const executeChatRouting = async (itemCard, type) => {
    const itemOwnerId = itemCard.userId;
    if (!itemOwnerId || itemOwnerId === 'anonymous_student') return;
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
          ownerId: itemOwnerId,
          listingType: type === "List" ? "listing" : "request",
          lastMessageText: "Room created. Start negotiating handoff details!",
          lastMessageTimestamp: Date.now(),
        };
        const docRef = await addDoc(collection(db, 'chats'), newChatRoom);
        targetChatId = docRef.id;
      }

      navigation.navigate('Chat', {
        screen: 'ChatConversation',
        params: { chatId: targetChatId, itemTitle: itemCard.item, peerId: itemOwnerId, peerUsername: itemCard.username || 'unknown' },
        initial: false 
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleTransactionInitiation = (item, type) => {
    if (type === 'Request') {
      Alert.alert('Initiate Loan', `Offer your ${item.item} to this borrower?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Chat', onPress: () => executeChatRouting(item, type) }
      ]);
    } else {
      Alert.alert('Request Item', `Request a loan for this ${item.item}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Request', onPress: () => executeChatRouting(item, type) }
      ]);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          setMenuVisible(false);
          try {
            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
            setTimeout(async () => { await auth.signOut(); }, 300);
          } catch (error) {
            console.error(error);
          }
        }
      }
    ]);
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
      <Modal animationType="slide" transparent={true} visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={() => setMenuVisible(false)} />
          <View style={styles.sideMenuContent}>
            <View style={styles.menuHeaderSection}>
              <Text style={styles.menuAccountHandle}>@{username}</Text>
              <Text style={styles.menuRatingLabel}>⭐ {userRating} ({userReviewsCount} reviews)</Text>
              <Text style={styles.menuAccountLabel}>LendIT Verified Student</Text>
            </View>

            <View style={styles.menuOptionsList}>
              <TouchableOpacity style={styles.menuOptionItem} onPress={() => { setMenuVisible(false); navigation.navigate('ProfileActivity', { mode: 'Your Posts' }); }}>
                <Text style={styles.menuOptionItemText}>Your Posts</Text>
              </TouchableOpacity>
              <View style={styles.menuSeparatorLine} />
              <TouchableOpacity style={styles.menuOptionItem} onPress={() => { setMenuVisible(false); navigation.navigate('ProfileActivity', { mode: 'Transactions' }); }}>
                <Text style={styles.menuOptionItemText}>Transactions</Text>
              </TouchableOpacity>
              <View style={styles.menuSeparatorLine} />
              <TouchableOpacity style={[styles.menuOptionItem, styles.logoutOptionItem]} onPress={handleLogout}>
                <Text style={[styles.menuOptionItemText, styles.logoutOptionText]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeHeader}>
          <View>
            <Text style={styles.greetingText}>Welcome back,</Text>
            <Text style={styles.usernameText}>@{username}</Text>
          </View>
          <TouchableOpacity style={styles.avatarButton} onPress={() => setMenuVisible(true)} activeOpacity={0.8}>
            <Image source={require('../assets/nus_logo.png')} style={styles.avatarImage} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Latest Request</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Search', { initialTab: 'Request' })}><Text style={styles.seeAllText}>See All →</Text></TouchableOpacity>
          </View>
          {peerBorrow ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.cardTitle}>Need: {peerBorrow.item}</Text>
                  <View style={styles.authorMetaRow}>
                    <Text style={styles.cardAuthor}>by @{peerBorrow.username || 'unknown'}</Text>
                    <UserRatingBadge userId={peerBorrow.userId} />
                  </View>
                </View>
                <Text style={styles.cardPrice}>${peerBorrow.willingToPay}</Text>
              </View>
              <Text style={styles.cardRow}>📍 Location: <Text style={styles.cardValue}>{getCampusLocationLabel(peerBorrow.location)}</Text></Text>
              <Text style={styles.cardRow}>📅 Timeline: <Text style={styles.cardValue}>{peerBorrow.borrowdate} to {peerBorrow.returndate}</Text></Text>
              <Text style={styles.cardRow}>🏦 Security Deposit: <Text style={styles.cardValue}>${peerBorrow.deposit}</Text></Text>
              <Text style={styles.cardRow}>💬 Details: <Text style={styles.cardValue}>{peerBorrow.description}</Text></Text>
              <TouchableOpacity style={styles.cardActionButton} onPress={() => handleTransactionInitiation(peerBorrow, 'Request')} activeOpacity={0.8}><Text style={styles.cardActionButtonText}>Offer to Lend</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCard}><Text style={styles.emptyCardText}>No peer borrow requests available right now.</Text></View>
          )}
        </View>

        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Latest Listing</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Search', { initialTab: 'List' })}><Text style={styles.seeAllText}>See All →</Text></TouchableOpacity>
          </View>
          {peerLend ? (
            <View style={[styles.card, styles.listingCard]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.cardTitle}>Item: {peerLend.item}</Text>
                  <View style={styles.authorMetaRow}>
                    <Text style={styles.cardAuthor}>by @{peerLend.username || 'unknown'}</Text>
                    <UserRatingBadge userId={peerLend.userId} />
                  </View>
                </View>
                <Text style={styles.cardPrice}>${peerLend.costPerDay}/day</Text>
              </View>
              <Text style={styles.cardRow}>📍 Location: <Text style={styles.cardValue}>{getCampusLocationLabel(peerLend.location)}</Text></Text>
              <Text style={styles.cardRow}>🛡️ Security Deposit: <Text style={styles.cardValue}>{peerLend.deposit}</Text></Text>
              <Text style={styles.cardRow}>💬 Requirements: <Text style={styles.cardValue}>{peerLend.returnConditions}</Text></Text>
              <TouchableOpacity style={[styles.cardActionButton, styles.listingActionButton]} onPress={() => handleTransactionInitiation(peerLend, 'List')} activeOpacity={0.8}><Text style={styles.cardActionButtonText}>Request to Borrow</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCard}><Text style={styles.emptyCardText}>No campus peer listings available at the moment.</Text></View>
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
  welcomeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f5' },
  greetingText: { fontSize: 16, color: '#8e8e93', fontWeight: '500' },
  usernameText: { fontSize: 26, fontWeight: 'bold', color: '#14004c', marginTop: 2 },
  avatarButton: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  modalContainer: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  backdropTouch: { flex: 1 },
  sideMenuContent: { width: width * 0.72, height: '100%', backgroundColor: '#ffffff', padding: 24, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 16 },
  menuHeaderSection: { alignItems: 'center', marginTop: 40, marginBottom: 15, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f5' },
  menuAccountHandle: { fontSize: 20, fontWeight: 'bold', color: '#14004c' },
  menuAccountLabel: { fontSize: 12, color: '#8e8e93', marginTop: 4, fontWeight: '500' },
  menuOptionsList: { flex: 1 },
  menuOptionItem: { paddingVertical: 16, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center' },
  menuOptionItemText: { fontSize: 17, fontWeight: '600', color: '#333333' },
  menuSeparatorLine: { height: 1, backgroundColor: '#f0f0f5', marginVertical: 12 },
  logoutOptionItem: { marginTop: 'auto', backgroundColor: '#fff0f0' },
  logoutOptionText: { color: '#ff3b30' },
  sectionWrapper: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#14004c' },
  seeAllText: { fontSize: 14, fontWeight: '700', color: '#2e2270' },
  card: { width: '100%', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e5e5ea', borderRadius: 20, padding: 18, marginBottom: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  listingCard: { borderColor: '#2e227025' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 19, fontWeight: 'bold', color: '#14004c', flex: 1, paddingRight: 10 },
  cardAuthor: { fontSize: 14, color: '#8e8e93', marginRight: 6 },
  cardPrice: { fontSize: 19, fontWeight: 'bold', color: '#14004c' },
  cardRow: { fontSize: 14, fontWeight: '700', color: '#555555', marginBottom: 6, lineHeight: 20 },
  cardValue: { fontWeight: '500', color: '#222222' },
  cardActionButton: { width: '100%', height: 44, backgroundColor: '#14004c', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  listingActionButton: { backgroundColor: '#2e2270' },
  cardActionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  emptyCard: { backgroundColor: '#f8f8fa', borderRadius: 16, padding: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e5ea', borderStyle: 'dashed' },
  emptyCardText: { color: '#8e8e93', fontSize: 14, textAlign: 'center' },
  menuRatingLabel: { fontSize: 15, fontWeight: '700', color: '#ffb300', marginTop: 6, backgroundColor: '#fff9e6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  authorMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingBadgeText: { fontSize: 12, fontWeight: '700', color: '#ffb300', backgroundColor: '#fff9e6', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, overflow: 'hidden' }
});