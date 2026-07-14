import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';

export default function ProfileActivityScreen({ route, navigation }) {
  const { mode } = route.params || { mode: 'Your Posts' };
  const [activeSubTab, setActiveSubTab] = useState('Request');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = auth.currentUser?.uid;

  // Edit Overlay States
  const [editingPost, setEditingPost] = useState(null);
  const [editItem, setEditItem] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDeposit, setEditDeposit] = useState('');
  const [editPriceOrPay, setEditPriceOrPay] = useState('');
  const [editExtraField, setEditExtraField] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: mode });
  }, [mode, navigation]);

  useEffect(() => {
    if (!currentUserId) return;

    setLoading(true);
    let unsubscribe = () => { };

    if (mode === 'Your Posts') {
      const qRequests = query(collection(db, 'requests'), where('userId', '==', currentUserId));
      const qListings = query(collection(db, 'listings'), where('userId', '==', currentUserId));
      const qTransactions = query(collection(db, 'transactions'));

      let localRequests = [];
      let localListings = [];
      let txMap = {};

      const combineAndSort = () => {
        const rawCombined = activeSubTab === 'Request' ? localRequests : localListings;


        const combinedWithStages = rawCombined.map(post => {
          let liveStage = post.status || 'active';
          if (txMap[post.id]) {
            liveStage = txMap[post.id];
          }
          return { ...post, calculatedStage: liveStage };
        });

        combinedWithStages.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
          return tB - tA;
        });

        setData(combinedWithStages);
        setLoading(false);
      };

      // Set up a structural reactive snapshot mesh to evaluate post lock situations in real time
      const unsubTx = onSnapshot(qTransactions, (txSnap) => {
        txMap = {};
        txSnap.forEach(d => {
          const txData = d.data();
          if (txData.chatId) {
            // Match transaction track records using the common identifier token fields
            txMap[txData.itemId] = txData.status;
          }
        });
        combineAndSort();
      });

      const unsubRequests = onSnapshot(qRequests, (snap) => {
        localRequests = snap.docs.map(doc => ({ id: doc.id, collectionType: 'requests', type: 'Request', ...doc.data() }));
        combineAndSort();
      });

      const unsubListings = onSnapshot(qListings, (snap) => {
        localListings = snap.docs.map(doc => ({ id: doc.id, collectionType: 'listings', type: 'Listing', ...doc.data() }));
        combineAndSort();
      });

      unsubscribe = () => {
        unsubTx();
        unsubRequests();
        unsubListings();
      };

    } else {
      const qTransactions = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
      unsubscribe = onSnapshot(qTransactions, (snapshot) => {
        const allTrans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // ✅ REGULATION 2 FIXED: Only show OTHER people's posts you interact with, AND only AFTER handoff code verification (status passes "verifying")
        const filteredTrans = allTrans.filter(t => {
          const amParticipant = t.lenderId === currentUserId || t.borrowerId === currentUserId;
          const isNotMyPost = t.ownerId !== currentUserId;
          const isHandedOver = t.status !== "verifying"; // True only when item moves into active loan state or later

          return amParticipant && isNotMyPost && isHandedOver;
        });

        setData(filteredTrans);
        setLoading(false);
      });
    }

    return () => unsubscribe();
  }, [mode, activeSubTab, currentUserId]);

  const handleDeletePost = (postId, collectionType, itemTitle) => {
    Alert.alert(
      "Delete Post",
      `Are you sure you want to remove your post for "${itemTitle}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setData(currentData =>
                currentData.map(post =>
                  post.id === postId ? { ...post, isDeleted: true } : post
                )
              );

              const postRef = doc(db, collectionType, postId);
              await updateDoc(postRef, {
                isDeleted: true,
                updatedAt: Date.now()
              });

            } catch (error) {
              Alert.alert("Error", "Could not remove post at this time.");
              setData(currentData =>
                currentData.map(post =>
                  post.id === postId ? { ...post, isDeleted: false } : post
                )
              );
            }
          }
        }
      ]
    );
  };

  const handleRepostPost = async (postId, collectionType) => {
    try {
      setData(currentData =>
        currentData.map(post =>
          post.id === postId ? { ...post, isDeleted: false } : post
        )
      );

      const postRef = doc(db, collectionType, postId);
      await updateDoc(postRef, {
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: Date.now()
      });

      Alert.alert("Success", "Your post has been successfully reposted to the campus feed!");
    } catch (error) {
      Alert.alert("Error", "Could not repost this item at this time.");
      setData(currentData =>
        currentData.map(post =>
          post.id === postId ? { ...post, isDeleted: true } : post
        )
      );
    }
  };

  const handleOpenEditModal = (item) => {
    setEditingPost(item);
    setEditItem(item.item || '');
    setEditLocation(item.location || '');
    setEditDeposit(item.deposit ? String(item.deposit) : '');

    if (item.type === 'Request') {
      setEditPriceOrPay(item.willingToPay ? String(item.willingToPay) : '');
      setEditExtraField(item.description || '');
    } else {
      setEditPriceOrPay(item.costPerDay ? String(item.costPerDay) : '');
      setEditExtraField(item.returnConditions || '');
    }
  };

  const handleUpdatePost = async () => {
    if (!editItem.trim() || !editLocation.trim()) {
      Alert.alert("Validation Error", "Item description and campus location cannot be empty.");
      return;
    }

    try {
      const postRef = doc(db, editingPost.collectionType, editingPost.id);
      const isRequest = editingPost.type === 'Request';

      const updatedPayload = {
        item: editItem.trim(),
        location: editLocation.trim(),
        deposit: editDeposit.trim(),
      };

      if (isRequest) {
        updatedPayload.willingToPay = editPriceOrPay.trim();
        updatedPayload.description = editExtraField.trim();
      } else {
        updatedPayload.costPerDay = editPriceOrPay.trim();
        updatedPayload.returnConditions = editExtraField.trim();
      }

      await updateDoc(postRef, updatedPayload);
      Alert.alert("Success", "Your post details were updated successfully.");
      setEditingPost(null);
    } catch (error) {
      Alert.alert("Update Failed", "Could not modify entry records at this time.");
    }
  };

  const mapProgressStageText = (calculatedStage) => {
    switch (calculatedStage) {
      case 'active': return '🟢 Live on Campus Feed';
      case 'finalized': return '🎯 Deal Partner Confirmed';
      case 'verifying': return '🔐 Handoff Token Generated';
      case 'pending': return '📦 Item Out on Loan';
      case 'returning': return '🔄 Return Verification in Progress';
      case 'returned': return '★ Complete (Awaiting Reviews)';
      case 'completed': return '✅ Closed & Archived';
      default: return '🔄 Processing Step';
    }
  };

  const renderItem = ({ item }) => {
    if (mode === 'Your Posts') {
      const isRequest = item.type === 'Request';
      const isSoftDeleted = item.isDeleted === true;

      // ✅ REGULATION 1 FIXED: Explicit layout boundary locks if item status moves past absolute active phase
      const isExchangeActive = item.status === 'finalized' || (item.calculatedStage && item.calculatedStage !== 'active');

      return (
        <View style={[
          styles.card,
          !isRequest && styles.listingCard,
          isSoftDeleted && styles.deletedCard,
          isExchangeActive && styles.lockedProgressCard
        ]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, isSoftDeleted && styles.disabledText]}>
              {isRequest ? 'Need' : 'Offering'}: {item.item} {isSoftDeleted && ' (Deleted)'}
            </Text>
            <Text style={[styles.cardPrice, isSoftDeleted && styles.disabledText]}>
              ${isRequest ? item.willingToPay : `${item.costPerDay}/day`}
            </Text>
          </View>

          <Text style={[styles.cardRow, isSoftDeleted && styles.disabledText]}>📍 Location: <Text style={styles.cardValue}>{item.location}</Text></Text>
          <Text style={[styles.cardRow, isSoftDeleted && styles.disabledText]}>🏦 Security Deposit: <Text style={styles.cardValue}>${item.deposit}</Text></Text>

          {isRequest ? (
            <>
              <Text style={[styles.cardRow, isSoftDeleted && styles.disabledText]}>
                📅 Timeline: <Text style={styles.cardValue}>{item.borrowdate} to {item.returndate}</Text>
              </Text>
              <Text style={[styles.cardRow, isSoftDeleted && styles.disabledText]}>
                💬 Details: <Text style={styles.cardValue}>{item.description}</Text>
              </Text>
            </>
          ) : (
            <Text style={[styles.cardRow, isSoftDeleted && styles.disabledText]}>
              💬 Requirements: <Text style={styles.cardValue}>{item.returnConditions}</Text>
            </Text>
          )}

          {/* Dynamic Workflow Status String Renderer */}
          <View style={styles.lifecycleStatusBadgeBox}>
            <Text style={styles.lifecycleStatusBadgeText}>{mapProgressStageText(item.calculatedStage)}</Text>
          </View>

          {/* Conditional Layout Action Dispatches */}
          {isSoftDeleted ? (
            <View style={styles.buttonActionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.repostButton]}
                onPress={() => handleRepostPost(item.id, item.collectionType)}
                activeOpacity={0.7}
              >
                <Text style={styles.btnText}>Repost</Text>
              </TouchableOpacity>
            </View>
          ) : isExchangeActive ? (
            // ✅ REGULATION 1 FIXED: Remove edit/delete access wrappers completely if item status enters active loan loops
            <View style={styles.lockedWarningBox}>
              <Text style={styles.lockedWarningLabelText}>🔒 Modification controls locked while exchange cycle is active.</Text>
            </View>
          ) : (
            <View style={styles.buttonActionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => handleOpenEditModal(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.btnText}>Edit Post</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDeletePost(item.id, item.collectionType, item.item)}
                activeOpacity={0.7}
              >
                <Text style={styles.btnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    } else {
      const isLender = item.lenderId === currentUserId;
      return (
        <View style={[styles.card, styles.transactionCardColorLayout]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📦 {item.itemTitle || 'Marketplace Item'}</Text>
            <Text style={[styles.statusBadge, { backgroundColor: item.status === 'completed' ? '#00875a' : '#ffb300' }]}>
              {item.status ? item.status.toUpperCase() : 'ACTIVE'}
            </Text>
          </View>
          <Text style={styles.cardRow}>Your Role: <Text style={styles.cardValue}>{isLender ? 'Lender (Item Owner)' : 'Borrower'}</Text></Text>

          <View style={[styles.lifecycleStatusBadgeBox, { marginTop: 10 }]}>
            <Text style={styles.lifecycleStatusBadgeText}>{mapProgressStageText(item.status)}</Text>
          </View>
          {/* ✅ FIXED: Removed old verification text links completely from layout rendering outputs */}
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {mode === 'Your Posts' && (
        <View style={styles.toggleWrapper}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, activeSubTab === 'Request' && styles.toggleButtonActive]}
              onPress={() => setActiveSubTab('Request')}
            >
              <Text style={[styles.toggleText, activeSubTab === 'Request' && styles.toggleTextActive]}>Requests</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, activeSubTab === 'Listing' && styles.toggleButtonActive]}
              onPress={() => setActiveSubTab('Listing')}
            >
              <Text style={[styles.toggleText, activeSubTab === 'Listing' && styles.toggleTextActive]}>Listings</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#14004c" /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No records found in this category.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={editingPost !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingPost(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderText}>Update Active Post</Text>
              <TouchableOpacity onPress={() => setEditingPost(null)}>
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.fieldLabel}>Item Name / Description:</Text>
              <TextInput
                style={styles.modalInput}
                value={editItem}
                onChangeText={setEditItem}
                placeholder="e.g., Apple Phone Charger"
              />

              <Text style={styles.fieldLabel}>📍 Campus Meetup Hub:</Text>
              <TextInput
                style={styles.modalInput}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="e.g., Central Library / UTown"
              />

              <Text style={styles.fieldLabel}>🏦 Collateral Security Deposit ($):</Text>
              <TextInput
                style={styles.modalInput}
                value={editDeposit}
                onChangeText={setEditDeposit}
                keyboardType="numeric"
                placeholder="0"
              />

              <Text style={styles.fieldLabel}>
                💰 {editingPost?.type === 'Request' ? 'Willing to Pay ($):' : 'Rental Rate per Day ($):'}
              </Text>
              <TextInput
                style={styles.modalInput}
                value={editPriceOrPay}
                onChangeText={setEditPriceOrPay}
                keyboardType="numeric"
                placeholder="0"
              />

              <Text style={styles.fieldLabel}>
                💬 {editingPost?.type === 'Request' ? 'Additional Description Details:' : 'Return Guidelines / Conditions:'}
              </Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                value={editExtraField}
                onChangeText={setEditExtraField}
                multiline={true}
                numberOfLines={3}
                placeholder="Provide conditions or details here..."
              />

              <TouchableOpacity style={styles.saveSubmitButton} onPress={handleUpdatePost}>
                <Text style={styles.saveSubmitButtonText}>Save & Apply Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  listPadding: { padding: 20, paddingTop: 10 },
  toggleWrapper: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, backgroundColor: '#ffffff' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#f0f0f5', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#e5e5ea' },
  toggleButton: { flex: 1, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  toggleButtonActive: { backgroundColor: '#14004c' },
  toggleText: { fontSize: 15, fontWeight: '700', color: '#636366' },
  toggleTextActive: { color: '#ffffff' },

  card: { width: '100%', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e5e5ea', borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  listingCard: { borderColor: '#2e227025' },
  deletedCard: { backgroundColor: '#f2f2f7', borderColor: '#d1d1d6', borderStyle: 'dashed' },
  lockedProgressCard: { backgroundColor: '#f9f9fc', borderColor: '#14004c25' },
  transactionCardColorLayout: { backgroundColor: '#fafdfb', borderColor: '#00875a25' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#14004c', flex: 1, paddingRight: 10 },
  cardPrice: { fontSize: 17, fontWeight: 'bold', color: '#14004c' },
  statusBadge: { fontSize: 11, fontWeight: '700', color: '#ffffff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, textTransform: 'uppercase' },
  cardRow: { fontSize: 14, fontWeight: '700', color: '#555555', marginBottom: 6, lineHeight: 20 },
  cardValue: { fontWeight: '500', color: '#222222' },
  disabledText: { color: '#8e8e93' },

  // Progress lifecycle badge design definitions
  lifecycleStatusBadgeBox: { backgroundColor: '#f0f0f5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginTop: 8 },
  lifecycleStatusBadgeText: { fontSize: 12, fontWeight: '700', color: '#14004c' },

  buttonActionRow: { flexDirection: 'row', marginTop: 16, width: '100%' },
  actionButton: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  editButton: { backgroundColor: '#2e2270', marginLeft: 0 },
  deleteButton: { backgroundColor: '#ff3a30dd' },
  repostButton: { backgroundColor: '#2e2270', marginLeft: 0 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  emptyText: { color: '#8e8e93', fontSize: 16, textAlign: 'center' },

  // Locked notice text labels box parameters
  lockedWarningBox: { width: '100%', paddingVertical: 10, backgroundColor: '#f2f2f7', borderRadius: 10, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
  lockedWarningLabelText: { fontStyle: 'italic', color: '#636366', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 34, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderColor: '#e5e5ea' },
  modalHeaderText: { fontSize: 20, fontWeight: '800', color: '#14004c' },
  modalCloseX: { fontSize: 20, fontWeight: '600', color: '#8e8e93', padding: 4 },
  modalScroll: { paddingTop: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#636366', marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: { backgroundColor: '#f2f2f7', borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 16, color: '#000000', borderWidth: 1, borderColor: '#e5e5ea' },
  textArea: { height: 80, paddingVertical: 12, textAlignVertical: 'top' },
  saveSubmitButton: { backgroundColor: '#14004c', borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 28, marginBottom: 10 },
  saveSubmitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
});