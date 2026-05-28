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

// Firebase requirements
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function SearchScreen() {
  // State management
  const [activeTab, setActiveTab] = useState('Request'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  const [requests, setRequests] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real time firebase synchronization
  useEffect(() => {
    setLoading(true);

    const qRequests = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(docs);
      if (activeTab === 'Request') setLoading(false);
    }, (error) => {
      console.error("Firestore Requests Fetch Error: ", error);
    });

    const qListings = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsubscribeListings = onSnapshot(qListings, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(docs);
      if (activeTab === 'List') setLoading(false);
    }, (error) => {
      console.error("Firestore Listings Fetch Error: ", error);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeListings();
    };
  }, [activeTab]);

  // Search filter logic
  const currentData = activeTab === 'Request' ? requests : listings;
  
  const filteredData = currentData.filter(itemData => {
    const itemTitle = itemData.item ? itemData.item.toLowerCase() : '';
    const itemDesc = itemData.description || itemData.returnConditions || '';
    const combinedText = `${itemTitle} ${itemDesc.toLowerCase()}`;
    return combinedText.includes(searchQuery.toLowerCase());
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Transaction handler
  const handleTransactionInitiation = (item) => {
    if (activeTab === 'Request') {
      Alert.alert(
        'Initiate Loan',
        `Would you like to offer your ${item.item} to this borrower? This will open a negotiation chat.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Chat', onPress: () => console.log('Link to ChatScreen for request:', item.id) }
        ]
      );
    } else {
      Alert.alert(
        'Request Item',
        `Would you like to request a loan for this ${item.item}? This will notify the lender.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm Request', onPress: () => console.log('Link to ChatScreen for listing:', item.id) }
        ]
      );
    }
  };

  // Rendering individual items
  const renderItemCard = ({ item }) => {
    if (activeTab === 'Request') {
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Need: {item.item}</Text>
            <Text style={styles.cardPrice}>${item.willingToPay}</Text>
          </View>
          <Text style={styles.cardRow}>📍 Location: <Text style={styles.cardValue}>{item.location}</Text></Text>
          <Text style={styles.cardRow}>📅 Timeline: <Text style={styles.cardValue}>{item.borrowdate} to {item.returndate}</Text></Text>
          <Text style={styles.cardRow}>🏦 Security Deposit: <Text style={styles.cardValue}>${item.deposit}</Text></Text>

          <Text style={styles.cardRow}>💬 Details: <Text style={styles.cardValue}>{item.description}</Text></Text>

          <TouchableOpacity 
            style={styles.cardActionButton} 
            onPress={() => handleTransactionInitiation(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardActionButtonText}>Offer to Lend</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <View style={[styles.card, styles.listingCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🔌 Available: {item.item}</Text>
            <Text style={styles.cardPrice}>${item.costPerDay}/day</Text>
          </View>
          <Text style={styles.cardRow}>📍 Location: <Text style={styles.cardValue}>{item.location}</Text></Text>
          <Text style={styles.cardRow}>🛡️ Security Deposit: <Text style={styles.cardValue}>${item.deposit}</Text></Text>

          <Text style={styles.cardRow}>💬 Requirements: <Text style={styles.cardValue}>{item.returnConditions}</Text></Text>

          <TouchableOpacity 
            style={[styles.cardActionButton, styles.listingActionButton]} 
            onPress={() => handleTransactionInitiation(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardActionButtonText}>Request to Borrow</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      
      {/* Top tab switcher */}
      <View style={styles.toggleWrapper}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleButton, activeTab === 'Request' && styles.toggleButtonActive]}
            onPress={() => { setActiveTab('Request'); setSearchQuery(''); }}
            activeOpacity={0.9}
          >
            <Text style={[styles.toggleText, activeTab === 'Request' && styles.toggleTextActive]}>Requests</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toggleButton, activeTab === 'List' && styles.toggleButtonActive]}
            onPress={() => { setActiveTab('List'); setSearchQuery(''); }}
            activeOpacity={0.9}
          >
            <Text style={[styles.toggleText, activeTab === 'List' && styles.toggleTextActive]}>Listings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchBarContainer}>
        <TextInput 
          style={styles.searchInput}
          placeholder={activeTab === 'Request' ? "Search requests by keyword..." : "Search available items to borrow..."}
          placeholderTextColor="#a0a0a0"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Infinite data stream */}
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
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#14004c" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>🔍 No inventory matches found.</Text>
              <Text style={styles.emptySubText}>Be the first to post this item on LendIT!</Text>
            </View>
          }
        />
      )}

    </SafeAreaView>
  );
}

// Styling
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
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listingCard: { borderColor: '#2e227025' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 19, fontWeight: 'bold', color: '#14004c', flex: 1, paddingRight: 10 },
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
  centerSpinner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#8e8e93', fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#444444', marginBottom: 6 },
  emptySubText: { fontSize: 14, color: '#8e8e93', textAlign: 'center' },
});