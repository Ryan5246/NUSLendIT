import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  Alert,
  StatusBar
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { db, auth } from '../firebaseConfig';
import { collection, query, onSnapshot, where, getDocs, doc, addDoc } from 'firebase/firestore';
import { getCampusLocationLabel } from './PostScreen';

const { width, height } = Dimensions.get('window');

export const CAMPUS_COORDINATES = {
  BIZ: { latitude: 1.2925, longitude: 103.7742 }, //done
  CDE: { latitude: 1.2990, longitude: 103.7719 }, //
  SOC: { latitude: 1.2945, longitude: 103.7741 },//
  FASS: { latitude: 1.2942, longitude: 103.7713 },//
  FoS: { latitude: 1.2968, longitude: 103.7801 },//
  USC: { latitude: 1.2995, longitude: 103.7755 },//
  MED: { latitude: 1.2965, longitude: 103.7818 },//
  SDE: { latitude: 1.2973, longitude: 103.7707 },//
  Field: { latitude: 1.2987, longitude: 103.7783 },//
  NUSC: { latitude: 1.3069, longitude: 103.7720 },//
  YST_MUSIC: { latitude: 1.3020, longitude: 103.7730 },//
  CENTRAL_LIBRARY: { latitude: 1.2965, longitude: 103.7731 },//
  YIH: { latitude: 1.2985, longitude: 103.7750 },//
  SRC_UTOWN: { latitude: 1.3044, longitude: 103.7725 },//
  ERC_UTOWN: { latitude: 1.3057, longitude: 103.7727 },//
  UCC: { latitude: 1.3015, longitude: 103.772 },//
  UHALL: { latitude: 1.2972, longitude: 103.7779 },//
  MPSH: { latitude: 1.3003, longitude: 103.7761 },//
  NUH: { latitude: 1.2937, longitude: 103.7832 },//
  KR_MRT: { latitude: 1.2931, longitude: 103.7845 },//
  KR_TERMINAL: { latitude: 1.2942, longitude: 103.7696 },//
  EUSOFF_HALL: { latitude: 1.2930, longitude: 103.7703 },//
  KR_HALL: { latitude: 1.2915, longitude: 103.7746 },//
  KEVII_HALL: { latitude: 1.2921, longitude: 103.7809 },//
  RAFFLES_HALL: { latitude: 1.2995, longitude: 103.7739 },//
  SHEARES_HALL: { latitude: 1.2911, longitude: 103.7756 },//
  TEMASEK_HALL: { latitude: 1.2925, longitude: 103.7713 },//
  PGPR: { latitude: 1.2903, longitude: 103.7806 },//
  PIONEER_HOUSE: { latitude: 1.2908, longitude: 103.7803 },//
  VALOUR_HOUSE: { latitude: 1.3005, longitude: 103.7751 },
  HELIX_HOUSE: { latitude: 1.2913, longitude: 103.7798 },//
  LIGHTHOUSE: { latitude: 1.2906, longitude: 103.7817 },//
  CAPT_RC: { latitude: 1.3076, longitude: 103.7732 },//
  RC4_RC: { latitude: 1.3082, longitude: 103.7734 },//
  TEMBUSU_RC: { latitude: 1.3061, longitude: 103.7738 },//
  RVRC_RC: { latitude: 1.2982, longitude: 103.7760 },//
  UTOWN_RES: { latitude: 1.3051, longitude: 103.7739 },//
  TCOMS: { latitude: 1.2935, longitude: 103.7770 },//
  I3_BUILDING: { latitude: 1.2924, longitude: 103.7756 },//
  VENTUS: { latitude: 1.2952, longitude: 103.7702 },//
  ALUMNI_HOUSE: { latitude: 1.2933, longitude: 103.7730 }//
};

function PeerRatingSummaryLabel({ userId }) {
  const [stars, setStars] = useState('⭐ New');

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onSnapshot(doc(db, 'username', userId), (userDoc) => {
      if (userDoc.exists()) {
        const data = userDoc.data();
        const avg = data.averageRating !== undefined ? data.averageRating.toFixed(1) : 'New';
        const count = data.ratingCount || 0;
        setStars(`⭐ ${avg} ${count > 0 ? `(${count})` : ''}`);
      }
    });
    return () => unsubscribe();
  }, [userId]);

  return <Text style={styles.sheetRatingLabel}>{stars}</Text>;
}

export default function MapsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Request');
  const [searchQuery, setSearchQuery] = useState('');
  const [rawItems, setRawItems] = useState([]);
  const [locationsGroup, setLocationsGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedHubKey, setSelectedHubKey] = useState(null);

  const currentUserId = auth.currentUser?.uid;
  const initialRegion = {
    latitude: 1.2972,
    longitude: 103.7772,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  useEffect(() => {
    setLoading(true);
    const targetCollection = activeTab === 'Request' ? 'requests' : 'listings';

    const q = query(collection(db, targetCollection), where("isDeleted", "==", false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dataItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const peerActiveItems = dataItems.filter(item =>
        item.userId !== currentUserId &&
        item.status !== "finalized"
      );
      setRawItems(peerActiveItems);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab, currentUserId]);

  useEffect(() => {
    const filtered = rawItems.filter(post => {
      const itemTitle = post.item ? post.item.toLowerCase() : '';
      const itemDesc = post.description || post.returnConditions || '';
      const friendlyLoc = getCampusLocationLabel(post.location).toLowerCase();
      const combined = `${itemTitle} ${itemDesc.toLowerCase()} ${friendlyLoc}`;
      return combined.includes(searchQuery.toLowerCase());
    });

    const groups = {};
    filtered.forEach(item => {
      if (item.location && CAMPUS_COORDINATES[item.location]) {
        if (!groups[item.location]) groups[item.location] = [];
        groups[item.location].push(item);
      }
    });
    setLocationsGroup(groups);
  }, [rawItems, searchQuery]);

  const handleOpenItemChat = async (itemCard) => {
    if (!itemCard) return;
    const itemOwnerId = itemCard.userId;
    if (!itemOwnerId || itemOwnerId === currentUserId) return;

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
          lastMessageText: "Room created via Map! Start negotiating details.",
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
      Alert.alert("Error", "Could not establish secure chat session.");
    }
  };

  const activeSheetItems = selectedHubKey ? (locationsGroup[selectedHubKey] || []) : [];

  return (
    <View style={styles.fullScreenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      <View style={styles.floatingControlPanel}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity style={[styles.toggleButton, activeTab === 'Request' && styles.toggleButtonActive]} onPress={() => { setActiveTab('Request'); setSearchQuery(''); setSelectedHubKey(null); }} activeOpacity={0.9}>
            <Text style={[styles.toggleText, activeTab === 'Request' && styles.toggleTextActive]}>Requests Map</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleButton, activeTab === 'List' && styles.toggleButtonActive]} onPress={() => { setActiveTab('List'); setSearchQuery(''); setSelectedHubKey(null); }} activeOpacity={0.9}>
            <Text style={[styles.toggleText, activeTab === 'List' && styles.toggleTextActive]}>Listings Map</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBarBox}>
          <TextInput style={styles.mapSearchInput} placeholder={activeTab === 'Request' ? "Search requests on map..." : "Search borrowable items nearby..."} placeholderTextColor="#a0a0a0" value={searchQuery} onChangeText={setSearchQuery} clearButtonMode="while-editing" autoCorrect={false} />
        </View>
      </View>

      {loading && (
        <View style={styles.mapLoadingOverlay}>
          <ActivityIndicator size="large" color="#14004c" />
          <Text style={styles.loadingText}>Projecting Campus Inventory...</Text>
        </View>
      )}

      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.mapCanvas}
        initialRegion={initialRegion}
        showsUserLocation={true}
        onPress={() => setSelectedHubKey(null)}
      >
        {Object.keys(CAMPUS_COORDINATES).map((locKey) => {
          const coordinates = CAMPUS_COORDINATES[locKey];
          const postsInLocation = locationsGroup[locKey] || [];
          const postCount = postsInLocation.length;

          if (postCount === 0) return null;

          const isSelected = selectedHubKey === locKey;

          return (
            <Marker

              key={`${locKey}_amt:${postCount}_sel:${isSelected}`}
              coordinate={coordinates}
              tracksViewChanges={false}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedHubKey(locKey);
              }}
            >
              <View style={styles.markerAnchorContainer}>
                {isSelected && <View style={styles.orangeHaloRingContainer} />}

                <View style={[
                  styles.customPinBubble,
                  activeTab === 'List' && styles.listingPinColor
                ]}>
                  <Text style={styles.pinTextNumber}>{postCount}</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {selectedHubKey && (
        <View style={styles.bottomSheetContainer}>
          <View style={styles.sheetHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetHubHeader}>📍 {getCampusLocationLabel(selectedHubKey)}</Text>
              <Text style={styles.sheetSubCount}>
                {activeSheetItems.length} active match{activeSheetItems.length === 1 ? '' : 'es'} filtered
              </Text>
            </View>
            <TouchableOpacity style={styles.closeSheetBtn} onPress={() => setSelectedHubKey(null)}>
              <Text style={styles.closeSheetBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {activeSheetItems.length === 0 ? (
            <View style={styles.sheetEmptyBox}>
              <Text style={styles.sheetEmptyText}>No items match your active search query at this hub.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.sheetScrollView}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {activeSheetItems.map((post) => (
                <TouchableOpacity
                  key={post.id}
                  style={styles.sheetItemCard}
                  onPress={() => handleOpenItemChat(post)}
                  activeOpacity={0.8}
                >
                  <View style={styles.itemCardTopLine}>
                    <Text style={styles.itemTitleText} numberOfLines={1}>
                      {activeTab === 'Request' ? 'Need' : 'Offer'}: {post.item}
                    </Text>
                    <Text style={styles.itemPriceText}>
                      {activeTab === 'Request' ? `$${post.willingToPay}` : `$${post.costPerDay}/d`}
                    </Text>
                  </View>

                  <View style={styles.itemCardMetaLine}>
                    <Text style={styles.userHandleText}>@{post.username || 'student'}</Text>
                    <PeerRatingSummaryLabel userId={post.userId} />
                  </View>

                  <Text style={styles.itemChatPromptText}>Tap to start negotiating →</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: { flex: 1, backgroundColor: '#ffffff' },
  floatingControlPanel: { position: 'absolute', top: Platform.OS === 'ios' ? 58 : StatusBar.currentHeight + 14, left: 20, right: 20, zIndex: 10 },
  searchBarBox: { width: '100%', backgroundColor: '#ffffff', borderRadius: 14, height: 48, borderWidth: 1.5, borderColor: '#e5e5ea', paddingHorizontal: 14, justifyContent: 'center', marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  mapSearchInput: { fontSize: 15, color: '#333333', width: '100%', height: '100%' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#e5e5ea', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  toggleButton: { flex: 1, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  toggleButtonActive: { backgroundColor: '#14004c' },
  toggleText: { fontSize: 15, fontWeight: '700', color: '#636366' },
  toggleTextActive: { color: '#ffffff' },
  mapCanvas: { width: width, height: height },
  mapLoadingOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 9, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#14004c', fontWeight: '700', fontSize: 15 },
  markerAnchorContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  orangeHaloRingContainer: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 3.5, borderColor: '#ffb300', backgroundColor: 'transparent' },
  customPinBubble: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#14004c', borderWidth: 2, borderColor: '#ffffff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 4 },
  listingPinColor: { backgroundColor: '#2e2270' },
  pinTextNumber: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  bottomSheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: height * 0.45, paddingHorizontal: 24, paddingVertical: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 20, zIndex: 20 },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f2f2f7', paddingBottom: 12, paddingRight: 8 },
  sheetHubHeader: { fontSize: 18, fontWeight: '800', color: '#14004c' },
  sheetSubCount: { fontSize: 12, fontWeight: '600', color: '#8e8e93', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  closeSheetBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f2f2f7', justifyContent: 'center', alignItems: 'center' },
  closeSheetBtnText: { fontSize: 13, fontWeight: '700', color: '#8e8e93' },
  sheetScrollView: { width: '100%' },
  sheetItemCard: { backgroundColor: '#f8f8fc', padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e5ea' },
  itemTitleText: { fontSize: 15, fontWeight: '700', color: '#222222', flex: 1, paddingRight: 8 },
  itemPriceText: { fontSize: 15, fontWeight: '800', color: '#14004c' },
  itemCardMetaLine: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 4 },
  userHandleText: { fontSize: 13, fontWeight: '600', color: '#636366', marginRight: 10 },
  sheetRatingLabel: { fontSize: 11, fontWeight: '700', color: '#ffb300', backgroundColor: '#fff9e6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, overflow: 'hidden' },
  itemChatPromptText: { fontSize: 12, fontWeight: '700', color: '#14004c', marginTop: 8, textTransform: 'uppercase' },
  sheetEmptyBox: { paddingVertical: 30, alignItems: 'center' },
  sheetEmptyText: { fontSize: 14, color: '#8e8e93', textAlign: 'center', fontWeight: '500' }
});