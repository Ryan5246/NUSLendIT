import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { db, auth } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, getDocs, addDoc, doc, getDoc, where } from 'firebase/firestore';
import { getCampusLocationLabel } from './PostScreen'; 

// Sub-component to fetch and cache user ratings reactively per post card
function UserRatingBadge({ userId }) {
  const [ratingInfo, setRatingInfo] = useState({ avg: 0, count: 0 });

  useEffect(() => {
    if (!userId) return;
    const fetchRating = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'username', userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setRatingInfo({
            avg: data.averageRating ? data.averageRating.toFixed(1) : 'New',
            count: data.ratingCount || 0
          });
        }
      } catch (err) {
        console.log("Error fetching badge stats:", err);
      }
    };
    fetchRating();
  }, [userId]);

  return (
    <Text style={styles.ratingBadgeText}>
      ⭐ {ratingInfo.avg} {ratingInfo.count > 0 ? `(${ratingInfo.count})` : ''}
    </Text>
  );
}

export default function SearchScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState('Request');
  const [searchQuery, setSearchQuery] = useState('');
  const [requests, setRequests] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
      navigation.setParams({ initialTab: undefined });
    }
  }, [route.params?.initialTab]);

  useEffect(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return;

    setLoading(true);
    let unsubscribeRequests = () => { };
    let unsubscribeListings = () => { };

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

      unsubscribeRequests();
      unsubscribeListings();

      const qRequests = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
      unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
        const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // ✅ FIXED: Ensures posts marked as "finalized" are dropped from search feeds
        const peerRequests = allDocs.filter(doc =>
          doc.userId !== currentUserId && 
          !blockedUserIds.includes(doc.userId) &&
          doc.status !== "finalized" &&
          doc.isDeleted !== true
        );
        setRequests(peerRequests);
        if (activeTab === 'Request') setLoading(false);
      }, (error) => {
        console.error("Firestore Requests Fetch Error: ", error);
      });

      const qListings = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
      unsubscribeListings = onSnapshot(qListings, (snapshot) => {
        const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // ✅ FIXED: Ensures listings marked as "finalized" are dropped from search feeds
        const peerListings = allDocs.filter(doc =>
          doc.userId !== currentUserId && 
          !blockedUserIds.includes(doc.userId) &&
          doc.status !== "finalized" &&
          doc.isDeleted !== true
        );
        setListings(peerListings);
        if (activeTab === 'List') setLoading(false);
      }, (error) => {
        console.error("Firestore Listings Fetch Error: ", error);
      });

    }, (error) => {
      console.error("Error loading block configurations on Search: ", error);
    });

    return () => {
      unsubscribeBlocks();
      unsubscribeRequests();
      unsubscribeListings();
    };
  }, [activeTab]);

  const currentData = activeTab === 'Request' ? requests : listings;
  const filteredData = currentData.filter(itemData => {
    const itemTitle = itemData.item ? itemData.item.toLowerCase() : '';
    const itemDesc = itemData.description || itemData.returnConditions || '';
    const locationString = getCampusLocationLabel(itemData.location).toLowerCase();
    const combinedText = `${itemTitle} ${itemDesc.toLowerCase()} ${locationString}`;
    return combinedText.includes(searchQuery.toLowerCase());
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const executeChatRouting = async (itemCard) => {
    const currentUserId = auth.currentUser?.uid;
    const itemOwnerId = itemCard.userId;

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
          listingType: activeTab === "List" ? "listing" : "request",
          lastMessageText: "Room created. Start negotiating handoff details!",
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
        },
        initial: false 
      });

    } catch (error) {
      console.error("Chat setup failure: ", error);
      Alert.alert("Error", "Could not establish a secure chat session.");
    }
  };

  const handleTransactionInitiation = (item) => {
    if (activeTab === 'Request') {
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

  const renderItemCard = ({ item }) => {
    const friendlyLocation = getCampusLocationLabel(item.location);

    if (activeTab === 'Request') {
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.cardTitle}>Need: {item.item}</Text>
              <View style={styles.authorMetaRow}>
                <Text style={styles.authorHandleText}>@{item.username || 'unknown'}</Text>
                <UserRatingBadge userId={item.userId} />
              </View>
            </View>
            <Text style={styles.cardPrice}>${item.willingToPay}</Text>
          </View>
          <Text style={styles.cardRow}>📍 Location: <Text style={styles.cardValue}>{friendlyLocation}</Text></Text>
          <Text style={styles.cardRow}>📅 Timeline: <Text style={styles.cardValue}>{item.borrowdate} to {item.returndate}</Text></Text>
          <Text style={styles.cardRow}>🏦 Security Deposit: <Text style={styles.cardValue}>${item.deposit}</Text></Text>
          <Text style={styles.cardRow}>💬 Details: <Text style={styles.cardValue}>{item.description}</Text></Text>

          <TouchableOpacity style={styles.cardActionButton} onPress={() => handleTransactionInitiation(item)} activeOpacity={0.8}>
            <Text style={styles.cardActionButtonText}>Offer to Lend</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <View style={[styles.card, styles.listingCard]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.cardTitle}>Item: {item.item}</Text>
              <View style={styles.authorMetaRow}>
                <Text style={styles.authorHandleText}>@{item.username || 'unknown'}</Text>
                <UserRatingBadge userId={item.userId} />
              </View>
            </View>
            <Text style={styles.cardPrice}>${item.costPerDay}/day</Text>
          </View>
          <Text style={styles.cardRow}>📍 Location: <Text style={styles.cardValue}>{friendlyLocation}</Text></Text>
          <Text style={styles.cardRow}>🛡️ Security Deposit: <Text style={styles.cardValue}>{item.deposit}</Text></Text>
          <Text style={styles.cardRow}>💬 Requirements: <Text style={styles.cardValue}>{item.returnConditions}</Text></Text>

          <TouchableOpacity style={[styles.cardActionButton, styles.listingActionButton]} onPress={() => handleTransactionInitiation(item)} activeOpacity={0.8}>
            <Text style={styles.cardActionButtonText}>Request to Borrow</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <View style={styles.toggleWrapper}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity style={[styles.toggleButton, activeTab === 'Request' && styles.toggleButtonActive]} onPress={() => { setActiveTab('Request'); setSearchQuery(''); }} activeOpacity={0.9}>
            <Text style={[styles.toggleText, activeTab === 'Request' && styles.toggleTextActive]}>Requests</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleButton, activeTab === 'List' && styles.toggleButtonActive]} onPress={() => { setActiveTab('List'); setSearchQuery(''); }} activeOpacity={0.9}>
            <Text style={[styles.toggleText, activeTab === 'List' && styles.toggleTextActive]}>Listings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'Request' ? "Search requests by keyword or place..." : "Search available items by hub..."}
          placeholderTextColor="#a0a0a0"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.centerSpinner}>
          <ActivityIndicator size="large" color="#14004c" />
          <Text style={styles.loadingText}>Syncing with NUS Network...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          renderItem={renderItemCard}
          contentContainerStyle={styles.listScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#14004c" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>🔍 No inventory matches found.</Text>
              <Text style={styles.emptySubtext}>Be the first to post this item on LendIT!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: { flex: 1, backgroundColor: '#ffffff' },
  toggleWrapper: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 6, backgroundColor: '#ffffff' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#f0f0f5', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#e5e5ea' },
  toggleButton: { flex: 1, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  toggleButtonActive: { backgroundColor: '#14004c', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  toggleText: { fontSize: 16, fontWeight: '700', color: '#636366' },
  toggleTextActive: { color: '#ffffff' },
  searchBarContainer: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#ffffff' },
  searchInput: { width: '100%', height: 48, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: '#333333', backgroundColor: '#fafafa' },
  listScrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 90 },
  card: { width: '100%', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e5e5ea', borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  listingCard: { borderColor: '#2e227025' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 19, fontWeight: 'bold', color: '#14004c' },
  cardPrice: { fontSize: 19, fontWeight: 'bold', color: '#14004c' },
  cardRow: { fontSize: 14, fontWeight: '700', color: '#555555', marginBottom: 6, lineHeight: 20 },
  cardValue: { fontWeight: '500', color: '#222222' },
  cardActionButton: { width: '100%', height: 44, backgroundColor: '#14004c', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  listingActionButton: { backgroundColor: '#2e2270' },
  cardActionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  centerSpinner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#8e8e93', fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#444444', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#8e8e93', textAlign: 'center' },
  authorMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  authorHandleText: { fontSize: 14, color: '#8e8e93', marginRight: 8, fontWeight: '500' },
  ratingBadgeText: { fontSize: 13, fontWeight: '700', color: '#ffb300', backgroundColor: '#fff9e6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' }
});