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
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps'; 
import { db, auth } from '../firebaseConfig';
import { collection, query, onSnapshot, where, getDocs, addDoc } from 'firebase/firestore';
import { getCampusLocationLabel } from './PostScreen'; 

const { width, height } = Dimensions.get('window');

// 📍 NUS Coordinates Registry Map compiled from map.nus.edu.sg positions
export const CAMPUS_COORDINATES = {
  BIZ: { latitude: 1.2925, longitude: 103.7742 },
  CDE: { latitude: 1.3002, longitude: 103.7716 },
  SOC: { latitude: 1.2945, longitude: 103.7741 },
  FASS: { latitude: 1.2979, longitude: 103.7728 },
  FoS: { latitude: 1.2968, longitude: 103.7801 },
  LAW: { latitude: 1.3190, longitude: 103.8181 },
  MED: { latitude: 1.2938, longitude: 103.7832 },
  SDE: { latitude: 1.2995, longitude: 103.7702 },
  DUKE_NUS: { latitude: 1.2801, longitude: 103.8344 },
  LKYSPP: { latitude: 1.3198, longitude: 103.8175 },
  NUSC: { latitude: 1.3055, longitude: 103.7725 },
  YST_MUSIC: { latitude: 1.3015, longitude: 103.7738 },
  CENTRAL_LIBRARY: { latitude: 1.2965, longitude: 103.7726 },
  YIH: { latitude: 1.2991, longitude: 103.7747 },
  SRC_UTOWN: { latitude: 1.3048, longitude: 103.7733 },
  ERC_UTOWN: { latitude: 1.3059, longitude: 103.7721 },
  PLAZA_UTOWN: { latitude: 1.3051, longitude: 103.7727 },
  UCC: { latitude: 1.3012, longitude: 103.7724 },
  UHALL: { latitude: 1.2994, longitude: 103.7719 },
  MPSH: { latitude: 1.2998, longitude: 103.7761 },
  NUH: { latitude: 1.2942, longitude: 103.7839 },
  KR_MRT: { latitude: 1.2931, longitude: 103.7852 },
  KR_TERMINAL: { latitude: 1.2937, longitude: 103.7699 },
  EUSOFF_HALL: { latitude: 1.2946, longitude: 103.7705 },
  KR_HALL: { latitude: 1.2934, longitude: 103.7792 },
  KEVII_HALL: { latitude: 1.2917, longitude: 103.7818 },
  RAFFLES_HALL: { latitude: 1.3005, longitude: 103.7739 },
  SHEARES_HALL: { latitude: 1.2922, longitude: 103.7788 },
  TEMASEK_HALL: { latitude: 1.2928, longitude: 103.7781 },
  PGPR: { latitude: 1.2905, longitude: 103.7812 },
  PIONEER_HOUSE: { latitude: 1.2909, longitude: 103.7806 },
  VALOUR_HOUSE: { latitude: 1.2912, longitude: 103.7809 },
  HELIX_HOUSE: { latitude: 1.2918, longitude: 103.7803 },
  LIGHTHOUSE: { latitude: 1.2931, longitude: 103.7709 },
  CINNAMON_RC: { latitude: 1.3054, longitude: 103.7726 },
  CAPT_RC: { latitude: 1.3065, longitude: 103.7734 },
  RC4_RC: { latitude: 1.3068, longitude: 103.7741 },
  TEMBUSU_RC: { latitude: 1.3062, longitude: 103.7748 },
  RVRC_RC: { latitude: 1.3011, longitude: 103.7782 },
  UTOWN_RES: { latitude: 1.3061, longitude: 103.7718 },
  KENT_VALE: { latitude: 1.3025, longitude: 103.7681 },
  TCOMS: { latitude: 1.2974, longitude: 103.7779 },
  I3_BUILDING: { latitude: 1.2932, longitude: 103.7766 },
  VENTUS: { latitude: 1.2961, longitude: 103.7718 },
  ALUMNI_HOUSE: { latitude: 1.2928, longitude: 103.7738 }
};

export default function MapsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Request');
  const [searchQuery, setSearchQuery] = useState('');
  const [rawItems, setRawItems] = useState([]);
  const [locationsGroup, setLocationsGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const currentUserId = auth.currentUser?.uid;

  const initialRegion = {
    latitude: 1.2972,
    longitude: 103.7772,
    latitudeDelta: 0.015,  
    longitudeDelta: 0.015, 
  };

  // 📡 Real-time Firestore Stream Listener
  useEffect(() => {
    setLoading(true);
    const targetCollection = activeTab === 'Request' ? 'requests' : 'listings';
    
    const q = query(
      collection(db, targetCollection), 
      where("isDeleted", "==", false)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dataItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const peerItems = dataItems.filter(item => item.userId !== currentUserId);
      
      setRawItems(peerItems);
      setLoading(false);
    }, (error) => {
      console.error("Maps sync failure: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab, currentUserId]);

  // 🔍 Computes filtered items and packs them into location groups on state mutation
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
        if (!groups[item.location]) {
          groups[item.location] = [];
        }
        groups[item.location].push(item);
      }
    });

    setLocationsGroup(groups);
  }, [rawItems, searchQuery]);

  // 💬 CHAT ROUTING SYSTEM: Initiates a text negotiation thread instantly upon tapping an item card
  const handleOpenItemChat = async (itemCard) => {
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
          lastMessageText: "Room created via Campus Map! Start negotiating handoff details.",
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
      console.error("Map chat routing failed: ", error);
      Alert.alert("Error", "Could not establish a secure chat session.");
    }
  };

  return (
    <View style={styles.fullScreenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* Floating Header Controls Wrapper */}
      <View style={styles.floatingControlPanel}>
        {/* 🔄 SWAPPED: Upper Mode Switch Selector is now at the very top */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleButton, activeTab === 'Request' && styles.toggleButtonActive]} 
            onPress={() => { setActiveTab('Request'); setSearchQuery(''); }}
            activeOpacity={0.9}
          >
            <Text style={[styles.toggleText, activeTab === 'Request' && styles.toggleTextActive]}>Requests Map</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, activeTab === 'List' && styles.toggleButtonActive]} 
            onPress={() => { setActiveTab('List'); setSearchQuery(''); }}
            activeOpacity={0.9}
          >
            <Text style={[styles.toggleText, activeTab === 'List' && styles.toggleTextActive]}>Listings Map</Text>
          </TouchableOpacity>
        </View>

        {/* 🔄 SWAPPED: Dynamic Live Item Search Input Row is now underneath */}
        <View style={styles.searchBarBox}>
          <TextInput
            style={styles.mapSearchInput}
            placeholder={activeTab === 'Request' ? "Search requests on map..." : "Search borrowable items nearby..."}
            placeholderTextColor="#a0a0a0"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        </View>
      </View>

      {loading && (
        <View style={styles.mapLoadingOverlay}>
          <ActivityIndicator size="large" color="#14004c" />
          <Text style={styles.loadingText}>Projecting Campus Inventory...</Text>
        </View>
      )}

      {/* Main Map Engine Element Canvas View */}
      <MapView 
        provider={PROVIDER_GOOGLE} 
        style={styles.mapCanvas} 
        initialRegion={initialRegion} 
        showsUserLocation={true}
      >
        {Object.keys(locationsGroup).map((locKey) => {
          const coordinates = CAMPUS_COORDINATES[locKey];
          const postsInLocation = locationsGroup[locKey];
          const postCount = postsInLocation.length;

          if (postCount === 0) return null; 

          return (
            <Marker
              key={locKey}
              coordinate={coordinates}
              tracksViewChanges={false}
            >
              <View style={[styles.customPinBubble, activeTab === 'List' && styles.listingPinColor]}>
                <Text style={styles.pinTextNumber}>{postCount}</Text>
              </View>

              <Callout tooltip={true} style={styles.calloutWindowContainer}>
                <View style={styles.calloutBubbleContent}>
                  <Text style={styles.calloutHubHeader}>📍 {getCampusLocationLabel(locKey)}</Text>
                  <Text style={styles.calloutSubCount}>{postCount} match{postCount === 1 ? '' : 'es'} found</Text>
                  
                  <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={true}>
                    {postsInLocation.map((post) => (
                      <TouchableOpacity 
                        key={post.id} 
                        style={styles.calloutItemCard}
                        onPress={() => handleOpenItemChat(post)}
                      >
                        <Text style={styles.itemTitleText} numberOfLines={1}>
                          {activeTab === 'Request' ? 'Need' : 'Offer'}: {post.item}
                        </Text>
                        <Text style={styles.itemMetaText}>
                          {activeTab === 'Request' ? `Pay: $${post.willingToPay}` : `Rate: $${post.costPerDay}/d`}
                        </Text>
                        <Text style={styles.itemChatPromptText}>Tap to negotiate →</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.calloutTrianglePointer} />
              </Callout>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: { flex: 1, backgroundColor: '#ffffff' },
  floatingControlPanel: { 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 58 : StatusBar.currentHeight + 14, 
    left: 20, 
    right: 20, 
    zIndex: 10 
  },
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
  customPinBubble: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#14004c', borderWidth: 2, borderColor: '#ffffff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 4 },
  listingPinColor: { backgroundColor: '#2e2270' },
  pinTextNumber: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  calloutWindowContainer: { width: 240, backgroundColor: 'transparent', alignItems: 'center' },
  calloutBubbleContent: { width: '100%', backgroundColor: '#ffffff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#e5e5ea', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 4 },
  calloutHubHeader: { fontSize: 14, fontWeight: '800', color: '#14004c', marginBottom: 2 },
  calloutSubCount: { fontSize: 11, fontWeight: '600', color: '#8e8e93', marginBottom: 8, textTransform: 'uppercase' },
  calloutTrianglePointer: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#ffffff', marginTop: -1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2 },
  calloutItemCard: { backgroundColor: '#f2f2f7', padding: 8, borderRadius: 8, marginBottom: 6, borderWidth: 0.5, borderColor: '#e5e5ea' },
  itemTitleText: { fontSize: 13, fontWeight: '700', color: '#222222' },
  itemMetaText: { fontSize: 12, fontWeight: '600', color: '#555555', marginTop: 1 },
  itemChatPromptText: { fontSize: 11, fontWeight: '700', color: '#14004c', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }
});