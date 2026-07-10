import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  FlatList
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Official NUS Map Reference Locations Lookup Dictionary
export const NUS_CAMPUS_HUBS = [
  // === FACULTIES, SCHOOLS & ACADEMIC CLUSTERS ===
  { label: "BIZ - NUS Business School (Mochtar Riady Bldg / Biz 1 / Biz 2)", value: "BIZ" },
  { label: "CDE - College of Design and Engineering (EA / E1 - E5 / EW1)", value: "CDE" },
  { label: "COM - School of Computing (COM 1 / COM 2)", value: "SOC" },
  { label: "FASS - Faculty of Arts & Social Sciences (The Deck / AS1 - AS7)", value: "FASS" },
  { label: "FoS - Faculty of Science (The Frontier / S1 - S17 Cluster)", value: "FoS" },
  { label: "LAW - Faculty of Law (Bukit Timah Campus)", value: "LAW" },
  { label: "MED - Yong Loo Lin School of Medicine (MD1 - MD11 Cluster)", value: "MED" },
  { label: "SDE - School of Design and Environment (SDE 1 / SDE 2 / SDE 3)", value: "SDE" },
  { label: "Duke-NUS Medical School (Outram Campus)", value: "DUKE_NUS" },
  { label: "LKYSPP - Lee Kuan Yew School of Public Policy", value: "LKYSPP" },
  { label: "NUSC - NUS College (Cinnamon College / UTown)", value: "NUSC" },
  { label: "YST - Yong Siew Toh Conservatory of Music", value: "YST_MUSIC" },

  // === CENTRAL HUBS & CAMPUS AMENITIES ===
  { label: "Central Library (CL / CL Annexe)", value: "CENTRAL_LIBRARY" },
  { label: "YIH - Yusof Ishak House (Student Union / Co-op / Starbucks)", value: "YIH" },
  { label: "UTown - Stephen Riady Centre (SRC)", value: "SRC_UTOWN" },
  { label: "UTown - Education Resource Centre (ERC)", value: "ERC_UTOWN" },
  { label: "UTown - Town Plaza (Koufu / Subway Plaza)", value: "PLAZA_UTOWN" },
  { label: "UCC - University Cultural Centre / Museum Area", value: "UCC" },
  { label: "UHALL - University Hall Cluster", value: "UHALL" },
  { label: "MPSH - Multi-Purpose Sports Halls (MPSH 1 - MPSH 6)", value: "MPSH" },
  { label: "NUH - National University Hospital (Kent Ridge Wing / Medical Centre)", value: "NUH" },

  // === TRANSPORT & TRANSIT TERMINALS ===
  { label: "Kent Ridge MRT Station (CC24)", value: "KR_MRT" },
  { label: "Kent Ridge Bus Terminal", value: "KR_TERMINAL" },

  // === HALLS OF RESIDENCE ===
  { label: "Halls: Eusoff Hall", value: "EUSOFF_HALL" },
  { label: "Halls: Kent Ridge Hall", value: "KR_HALL" },
  { label: "Halls: King Edward VII Hall", value: "KEVII_HALL" },
  { label: "Halls: Raffles Hall", value: "RAFFLES_HALL" },
  { label: "Halls: Sheares Hall", value: "SHEARES_HALL" },
  { label: "Halls: Temasek Hall", value: "TEMASEK_HALL" },

  // === STUDENT RESIDENCES & HOUSES ===
  { label: "Residences: Prince George's Park Residences (PGPR)", value: "PGPR" },
  { label: "Residences: Pioneer House", value: "PIONEER_HOUSE" },
  { label: "Residences: Valour House", value: "VALOUR_HOUSE" },
  { label: "Houses: Helix House", value: "HELIX_HOUSE" },
  { label: "Houses: LightHouse", value: "LIGHTHOUSE" },

  // === RESIDENTIAL COLLEGES & GRADUATE HOUSING ===
  { label: "RCs: Cinnamon College (USP)", value: "CINNAMON_RC" },
  { label: "RCs: College of Alice & Peter Tan (CAPT)", value: "CAPT_RC" },
  { label: "RCs: Residential College 4 (RC4)", value: "RC4_RC" },
  { label: "RCs: Tembusu College", value: "TEMBUSU_RC" },
  { label: "RCs: Ridge View Residential College (RVRC)", value: "RVRC_RC" },
  { label: "Grad: UTown Residence (North Tower / South Tower)", value: "UTOWN_RES" },
  { label: "Grad: Kent Vale Staff Residences", value: "KENT_VALE" },

  // === SPECIAL RESEARCH BUILDINGS ===
  { label: "TCOMS (Technology Centre for Offshore and Marine, Singapore)", value: "TCOMS" },
  { label: "I3 Building (Innovation 4.0)", value: "I3_BUILDING" },
  { label: "Ventus (University Campus Infrastructure Building)", value: "VENTUS" },
  { label: "Shaw Foundation Alumni House / NUSS Guild House", value: "ALUMNI_HOUSE" }
];

export const getCampusLocationLabel = (valueKey) => {
  const match = NUS_CAMPUS_HUBS.find(hub => hub.value === valueKey);
  return match ? match.label : "Select a meetup spot...";
};

const formatDateString = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// 🔍 Reconfigured Shared Searchable Selector Component
function HubPickerModal({ visible, onClose, onSelect }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Clear query on close or reset triggers
  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  // Filter items match-by-match on layout computation
  const filteredHubs = NUS_CAMPUS_HUBS.filter(hub =>
    hub.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderText}>Select Location</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.modalCloseX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 🔍 Dynamic Filter Input Box */}
          <View style={styles.modalSearchWrapper}>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search campus spot (e.g., UTown, BIZ)..."
              placeholderTextColor="#a0a0a0"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={filteredHubs}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.locationOptionRow}
                onPress={() => {
                  onSelect(item.value);
                  handleClose();
                }}
              >
                <Text style={styles.locationOptionText}>{item.label}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.modalEmptyBox}>
                <Text style={styles.modalEmptyText}>No locations match your search.</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

function RequestForm() {
  const [username, setUsername] = useState('anonymous');
  const [item, setItem] = useState('');
  const [location, setLocation] = useState(''); 
  const [borrowDate, setBorrowDate] = useState(new Date());
  const [returnDate, setReturnDate] = useState(new Date());
  const [willingToPay, setWillingToPay] = useState('');
  const [deposit, setDeposit] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const [showBorrowPicker, setShowBorrowPicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);

  useEffect(() => {
    const fetchUsername = async () => {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) return;
      const docSnap = await getDoc(doc(db, 'username', currentUserId));
      if (docSnap.exists()) {
        setUsername(docSnap.data().username);
      }
    };
    fetchUsername();
  }, []);

  const handleBorrowDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowBorrowPicker(false);
    if (selectedDate) setBorrowDate(selectedDate);
  };

  const handleReturnDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowReturnPicker(false);
    if (selectedDate) setReturnDate(selectedDate);
  };

  const handlePostRequest = async () => {
    if (!item || !location || !borrowDate || !returnDate || !willingToPay || !deposit || !description) {
      return Alert.alert('Missing Fields', 'Please fill out all fields.');
    }

    setLoading(true);

    try {
      await addDoc(collection(db, 'requests'), {
        userId: auth.currentUser?.uid || 'anonymous_student',
        username: username,
        item: item,
        location: location, 
        borrowdate: formatDateString(borrowDate),
        returndate: formatDateString(returnDate),
        willingToPay: willingToPay,
        deposit: deposit,
        description: description,
        createdAt: serverTimestamp(),
        isDeleted: false
      });

      Alert.alert('Success', 'Your borrow request has been posted!');
      setItem('');
      setLocation('');
      setBorrowDate(new Date());
      setReturnDate(new Date());
      setWillingToPay('');
      setDeposit('');
      setDescription('');
    } catch (error) {
      console.error("Firestore Error: ", error);
      Alert.alert('Database Error', 'Could not save your post. Make sure your internet is working.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.formContextTitle}>What do you need to borrow?</Text>

      <Text style={styles.label}>Item:</Text>
      <TextInput style={styles.input} placeholder="Eg: Calculator" placeholderTextColor="#a0a0a0" value={item} onChangeText={setItem} />

      <Text style={styles.label}>Location:</Text>
      <TouchableOpacity style={styles.dropdownInput} activeOpacity={0.7} onPress={() => setPickerModalVisible(true)}>
        <Text style={[styles.dropdownValueText, !location && { color: '#a0a0a0' }]} numberOfLines={1}>
          {getCampusLocationLabel(location)}
        </Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Borrow Date:</Text>
      <TouchableOpacity
        style={styles.dropdownInput}
        onPress={() => {
          setShowBorrowPicker(true);
          setShowReturnPicker(false);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownValueText}>{formatDateString(borrowDate)}</Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>

      {showBorrowPicker && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.pickerDoneStrip} onPress={() => setShowBorrowPicker(false)}>
          <Text style={styles.pickerDoneText}>Confirm Borrow Date</Text>
        </TouchableOpacity>
      )}
      {showBorrowPicker && (
        <DateTimePicker
          value={borrowDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={handleBorrowDateChange}
        />
      )}

      <Text style={styles.label}>Return Date:</Text>
      <TouchableOpacity
        style={styles.dropdownInput}
        onPress={() => {
          setShowReturnPicker(true);
          setShowBorrowPicker(false);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownValueText}>{formatDateString(returnDate)}</Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>

      {showReturnPicker && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.pickerDoneStrip} onPress={() => setShowReturnPicker(false)}>
          <Text style={styles.pickerDoneText}>Confirm Return Date</Text>
        </TouchableOpacity>
      )}
      {showReturnPicker && (
        <DateTimePicker
          value={returnDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={borrowDate}
          onChange={handleReturnDateChange}
        />
      )}

      <Text style={styles.label}>Willing To Pay:</Text>
      <TextInput style={styles.input} placeholder="Eg: 1.70" placeholderTextColor="#a0a0a0" value={willingToPay} onChangeText={setWillingToPay} />

      <Text style={styles.label}>Security Deposit:</Text>
      <TextInput style={styles.input} placeholder="Eg: 12.00" placeholderTextColor="#a0a0a0" value={deposit} onChangeText={setDeposit} />

      <Text style={styles.label}>Description:</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="Eg: Casio Model Ex-1312" placeholderTextColor="#a0a0a0" multiline={true} value={description} onChangeText={setDescription} />

      <TouchableOpacity style={styles.submitButton} onPress={handlePostRequest} disabled={loading}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>Post Request</Text>}
      </TouchableOpacity>

      <HubPickerModal visible={pickerModalVisible} onClose={() => setPickerModalVisible(false)} onSelect={setLocation} />
    </ScrollView>
  );
}

function ListingForm() {
  const [username, setUsername] = useState('anonymous');
  const [item, setItem] = useState('');
  const [location, setLocation] = useState('');
  const [costPerDay, setCostPerDay] = useState('');
  const [deposit, setDeposit] = useState('');
  const [returnConditions, setReturnConditions] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);

  useEffect(() => {
    const fetchUsername = async () => {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) return;
      const docSnap = await getDoc(doc(db, 'username', currentUserId));
      if (docSnap.exists()) {
        setUsername(docSnap.data().username);
      }
    };
    fetchUsername();
  }, []);

  const handlePostListing = async () => {
    if (!item || !location || !costPerDay || !deposit || !returnConditions) {
      return Alert.alert('Missing Fields', 'Please fill out all fields.');
    }

    setLoading(true);

    try {
      await addDoc(collection(db, 'listings'), {
        userId: auth.currentUser?.uid || 'anonymous_student',
        username: username,
        item: item,
        location: location,
        costPerDay: costPerDay,
        deposit: deposit,
        returnConditions: returnConditions,
        createdAt: serverTimestamp(),
        isDeleted: false
      });

      Alert.alert('Success', 'Your item listing has been posted!');
      setItem('');
      setLocation('');
      setCostPerDay('');
      setDeposit('');
      setReturnConditions('');
    } catch (error) {
      console.error("Firestore Error: ", error);
      Alert.alert('Database Error', 'Could not save your listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.formContextTitle}>What are you offering to lend?</Text>

      <Text style={styles.label}>Item:</Text>
      <TextInput style={styles.input} placeholder="Eg: Lab Coat" placeholderTextColor="#a0a0a0" value={item} onChangeText={setItem} />

      <Text style={styles.label}>Location:</Text>
      <TouchableOpacity style={styles.dropdownInput} activeOpacity={0.7} onPress={() => setPickerModalVisible(true)}>
        <Text style={[styles.dropdownValueText, !location && { color: '#a0a0a0' }]} numberOfLines={1}>
          {getCampusLocationLabel(location)}
        </Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Cost Per Day:</Text>
      <TextInput style={styles.input} placeholder="Eg: 0.50" placeholderTextColor="#a0a0a0" value={costPerDay} onChangeText={setCostPerDay} />

      <Text style={styles.label}>Security Deposit:</Text>
      <TextInput style={styles.input} placeholder="Eg: 10.25" placeholderTextColor="#a0a0a0" value={deposit} onChangeText={setDeposit} />

      <Text style={styles.label}>Return Requirements:</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="Eg: Wash before returning. Must return by end of reading week." placeholderTextColor="#a0a0a0" multiline={true} value={returnConditions} onChangeText={setReturnConditions} />

      <TouchableOpacity style={[styles.submitButton, styles.listingSubmitBtn]} onPress={handlePostListing} disabled={loading}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>Post Listing</Text>}
      </TouchableOpacity>

      <HubPickerModal visible={pickerModalVisible} onClose={() => setPickerModalVisible(false)} onSelect={setLocation} />
    </ScrollView>
  );
}

export default function PostScreen() {
  const [activeTab, setActiveTab] = useState('Request');

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.toggleWrapper}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity style={[styles.toggleButton, activeTab === 'Request' && styles.toggleButtonActive]} onPress={() => setActiveTab('Request')} activeOpacity={0.9}>
              <Text style={[styles.toggleText, activeTab === 'Request' && styles.toggleTextActive]}>Request</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleButton, activeTab === 'List' && styles.toggleButtonActive]} onPress={() => setActiveTab('List')} activeOpacity={0.9}>
              <Text style={[styles.toggleText, activeTab === 'List' && styles.toggleTextActive]}>List</Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'Request' ? <RequestForm /> : <ListingForm />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1 },
  toggleWrapper: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, backgroundColor: '#ffffff' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#f0f0f5', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#e5e5ea' },
  toggleButton: { flex: 1, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  toggleButtonActive: { backgroundColor: '#14004c', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  toggleText: { fontSize: 16, fontWeight: '700', color: '#636366' },
  toggleTextActive: { color: '#ffffff' },
  formContextTitle: { fontSize: 15, color: '#8e8e93', fontWeight: '600' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 15, paddingBottom: 80 },
  label: { fontSize: 18, fontWeight: 'bold', color: '#14004c', marginTop: 14, marginBottom: 6 },
  input: { width: '100%', height: 50, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: '#333333', backgroundColor: '#fafafa' },
  textArea: { height: 110, paddingTop: 12, textAlignVertical: 'top' },
  submitButton: { width: '100%', height: 56, backgroundColor: '#14004c', borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  listingSubmitBtn: { backgroundColor: '#2e2270' },
  submitButtonText: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  dropdownInput: { width: '100%', height: 50, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, paddingHorizontal: 16, backgroundColor: '#fafafa', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  dropdownValueText: { fontSize: 16, color: '#333333', flex: 1, paddingRight: 10 },
  dropdownArrow: { fontSize: 12, color: '#14004c', fontWeight: 'bold' },
  pickerDoneStrip: { width: '100%', backgroundColor: '#f0f0f5', paddingVertical: 10, paddingHorizontal: 16, alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#e5e5ea', marginTop: 6, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  pickerDoneText: { color: '#14004c', fontWeight: 'bold', fontSize: 15 },

  // Slide-Up Modal Themes
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 34, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, paddingBottom: 12 },
  modalHeaderText: { fontSize: 20, fontWeight: '800', color: '#14004c' },
  modalCloseX: { fontSize: 20, fontWeight: '600', color: '#8e8e93', padding: 4 },
  locationOptionRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f2f2f7' },
  locationOptionText: { fontSize: 16, fontWeight: '600', color: '#333333' },
  
  // 🔍 Inner Search Bar Styles
  modalSearchWrapper: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e5ea', marginBottom: 6 },
  modalSearchInput: { width: '100%', height: 44, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: '#333333', backgroundColor: '#f2f2f7' },
  modalEmptyBox: { paddingVertical: 40, alignItems: 'center' },
  modalEmptyText: { color: '#8e8e93', fontSize: 15, fontWeight: '500' }
});