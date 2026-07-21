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

import {
  doc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  query,
  where
} from 'firebase/firestore';

export const NUS_CAMPUS_HUBS = [
  { label: "BIZ - NUS Business School", value: "BIZ" },
  { label: "CDE - College of Design and Engineering", value: "CDE" },
  { label: "COM - School of Computing", value: "SOC" },
  { label: "FASS - Faculty of Arts & Social Sciences", value: "FASS" },
  { label: "FoS - Faculty of Science", value: "FoS" },
  { label: "MED - Yong Loo Lin School of Medicine", value: "MED" },
  { label: "SDE - School of Design and Environment", value: "SDE" },
  { label: "YST - Yong Siew Toh Conservatory of Music", value: "YST_MUSIC" },

  { label: "CLB - Central Library", value: "CENTRAL_LIBRARY" },
  { label: "YIH - Yusof Ishak House", value: "YIH" },
  { label: "USC - University Sports Centre", value: "USC" },
  { label: "SRC - Stephen Riady Centre", value: "SRC_UTOWN" },
  { label: "ERC - Education Resource Centre", value: "ERC_UTOWN" },
  { label: "UCC - University Cultural Centre / Museum", value: "UCC" },
  { label: "UHALL - University Hall", value: "UHALL" },
  { label: "MPSH - Multi-Purpose Sports Halls", value: "MPSH" },
  { label: "NUH - National University Hospital", value: "NUH" },
  { label: "NUS Field", value: "Field" },

  { label: "Kent Ridge MRT Station", value: "KR_MRT" },
  { label: "Kent Ridge Bus Terminal", value: "KR_TERMINAL" },

  { label: "Eusoff Hall", value: "EUSOFF_HALL" },
  { label: "Kent Ridge Hall", value: "KR_HALL" },
  { label: "King Edward VII Hall", value: "KEVII_HALL" },
  { label: "Raffles Hall", value: "RAFFLES_HALL" },
  { label: "Sheares Hall", value: "SHEARES_HALL" },
  { label: "Temasek Hall", value: "TEMASEK_HALL" },

  { label: "PGPR - Prince George's Park Residences", value: "PGPR" },
  { label: "Pioneer House", value: "PIONEER_HOUSE" },
  { label: "Valour House", value: "VALOUR_HOUSE" },
  { label: "Helix House", value: "HELIX_HOUSE" },
  { label: "Light House", value: "LIGHTHOUSE" },

  { label: "NUSC - NUS College", value: "NUSC" },
  { label: "CAPT - College of Alice & Peter Tan", value: "CAPT_RC" },
  { label: "RC4 - Residential College 4", value: "RC4_RC" },
  { label: "RVRC - Ridge View Residential College", value: "RVRC_RC" },
  { label: "UTR - UTown Residence", value: "UTOWN_RES" },
  { label: "Tembusu College", value: "TEMBUSU_RC" },

  { label: "TCOMS - Technology Centre for Offshore and Marine, Singapore", value: "TCOMS" },
  { label: "I3 Building (Innovation 4.0)", value: "I3_BUILDING" },
  { label: "Ventus", value: "VENTUS" },
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

export const CAMPUS_COORDINATES = {
  BIZ: { latitude: 1.2925, longitude: 103.7742 },
  CDE: { latitude: 1.2990, longitude: 103.7719 },
  SOC: { latitude: 1.2945, longitude: 103.7741 },
  FASS: { latitude: 1.2942, longitude: 103.7713 },
  FoS: { latitude: 1.2968, longitude: 103.7801 },
  USC: { latitude: 1.2995, longitude: 103.7755 },
  MED: { latitude: 1.2965, longitude: 103.7818 },
  SDE: { latitude: 1.2973, longitude: 103.7707 },
  Field: { latitude: 1.2987, longitude: 103.7783 },
  NUSC: { latitude: 1.3069, longitude: 103.7720 },
  YST_MUSIC: { latitude: 1.3020, longitude: 103.7730 },
  CENTRAL_LIBRARY: { latitude: 1.2965, longitude: 103.7731 },
  YIH: { latitude: 1.2985, longitude: 103.7750 },
  SRC_UTOWN: { latitude: 1.3044, longitude: 103.7725 },
  ERC_UTOWN: { latitude: 1.3057, longitude: 103.7727 },
  UCC: { latitude: 1.3015, longitude: 103.772 },
  UHALL: { latitude: 1.2972, longitude: 103.7779 },
  MPSH: { latitude: 1.3003, longitude: 103.7761 },
  NUH: { latitude: 1.2937, longitude: 103.7832 },
  KR_MRT: { latitude: 1.2931, longitude: 103.7845 },
  KR_TERMINAL: { latitude: 1.2942, longitude: 103.7696 },
  EUSOFF_HALL: { latitude: 1.2930, longitude: 103.7703 },
  KR_HALL: { latitude: 1.2915, longitude: 103.7746 },
  KEVII_HALL: { latitude: 1.2921, longitude: 103.7809 },
  RAFFLES_HALL: { latitude: 1.2995, longitude: 103.7739 },
  SHEARES_HALL: { latitude: 1.2911, longitude: 103.7756 },
  TEMASEK_HALL: { latitude: 1.2925, longitude: 103.7713 },
  PGPR: { latitude: 1.2903, longitude: 103.7806 },
  PIONEER_HOUSE: { latitude: 1.2908, longitude: 103.7803 },
  VALOUR_HOUSE: { latitude: 1.3005, longitude: 103.7751 },
  HELIX_HOUSE: { latitude: 1.2913, longitude: 103.7798 },
  LIGHTHOUSE: { latitude: 1.2906, longitude: 103.7817 },
  CAPT_RC: { latitude: 1.3076, longitude: 103.7732 },
  RC4_RC: { latitude: 1.3082, longitude: 103.7734 },
  TEMBUSU_RC: { latitude: 1.3061, longitude: 103.7738 },
  RVRC_RC: { latitude: 1.2982, longitude: 103.7760 },
  UTOWN_RES: { latitude: 1.3051, longitude: 103.7739 },
  TCOMS: { latitude: 1.2935, longitude: 103.7770 },
  I3_BUILDING: { latitude: 1.2924, longitude: 103.7756 },
  VENTUS: { latitude: 1.2952, longitude: 103.7702 },
  ALUMNI_HOUSE: { latitude: 1.2933, longitude: 103.7730 }
};

const NEARBY_NOTIFICATION_RADIUS_KM = 0.5;

const toRadians = (degrees) => degrees * Math.PI / 180;

const calculateDistanceKm = (pointA, pointB) => {
  const earthRadiusKm = 6371;
  const latitudeDifference = toRadians(pointB.latitude - pointA.latitude);
  const longitudeDifference = toRadians(pointB.longitude - pointA.longitude);
  const firstLatitude = toRadians(pointA.latitude);
  const secondLatitude = toRadians(pointB.latitude);

  const value =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
    Math.cos(secondLatitude) *
    Math.sin(longitudeDifference / 2) ** 2;

  const angularDistance =
    2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));

  return earthRadiusKm * angularDistance;
};

const normaliseItemName = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
};

const itemNamesMatch = (requestedItem, listedItem) => {
  const requestText = normaliseItemName(requestedItem);
  const listingText = normaliseItemName(listedItem);

  if (!requestText || !listingText) {
    return false;
  }

  if (requestText === listingText) {
    return true;
  }

  if (
    requestText.includes(listingText) ||
    listingText.includes(requestText)
  ) {
    return true;
  }

  const requestWords = new Set(requestText.split(' '));

  return listingText
    .split(' ')
    .some(
      word =>
        word.length >= 3 &&
        requestWords.has(word)
    );
};

const isValidExpoPushToken = (token) => {
  return (
    typeof token === 'string' &&
    (
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[')
    )
  );
};

const sendExpoPushMessages = async (messages) => {
  if (!messages.length) {
    return 0;
  }

  const response = await fetch(
    'https://exp.host/--/api/v2/push/send',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messages)
    }
  );

  const responseData = await response.json();

  if (!response.ok) {
    console.error(
      'Expo notification error:',
      responseData
    );

    return 0;
  }

  console.log(
    'Nearby notification result:',
    responseData
  );

  return messages.length;
};

const notifyNearbyListingOwners = async ({
  requestId,
  requesterId,
  requestedItem,
  requestLocation,
  requesterUsername
}) => {
  try {
    const requestCoordinates =
      CAMPUS_COORDINATES[requestLocation];

    if (!requestCoordinates) {
      console.log(
        'No coordinates for request location:',
        requestLocation
      );

      return 0;
    }

    const listingsQuery = collection(db, 'listings');

    const listingsSnapshot =
      await getDocs(listingsQuery);

    const matchingOwners = new Map();

    for (const listingDoc of listingsSnapshot.docs) {
      const listing = listingDoc.data();

      if (
        !listing.userId ||
        listing.userId === requesterId ||
        listing.status === 'finalized'
      ) {
        continue;
      }

      if (
        !itemNamesMatch(
          requestedItem,
          listing.item
        )
      ) {
        continue;
      }

      const listingCoordinates =
        CAMPUS_COORDINATES[listing.location];

      if (!listingCoordinates) {
        continue;
      }

      const distanceKm = calculateDistanceKm(
        requestCoordinates,
        listingCoordinates
      );

      if (distanceKm > NEARBY_NOTIFICATION_RADIUS_KM) {
        continue;
      }

      if (!matchingOwners.has(listing.userId)) {
        matchingOwners.set(listing.userId, {
          listingId: listingDoc.id,
          location: listing.location,
          distanceKm
        });
      }
    }

    const notificationMessages = [];

    for (const [ownerId, match] of matchingOwners) {
      const ownerProfileSnapshot =
        await getDoc(
          doc(db, 'username', ownerId)
        );

      if (!ownerProfileSnapshot.exists()) {
        continue;
      }

      const ownerProfile =
        ownerProfileSnapshot.data();

      const token = ownerProfile.expoPushToken;

      console.log("Listing owner:", ownerId);
      console.log("Owner Expo token:", token);

      if (!isValidExpoPushToken(token)) {
        console.log("Notification skipped: invalid or missing Expo token");
        continue;
      }

      console.log("Valid Expo token found");

      notificationMessages.push({
        to: token,
        sound: 'default',
        priority: 'high',
        channelId: 'nearby-requests',

        title:
          '📦 Someone nearby needs your item',

        body:
          `@${requesterUsername || 'student'} needs ` +
          `${requestedItem} within ${match.distanceKm.toFixed(1)} km of your listing at ${getCampusLocationLabel(match.location)}.`,

        data: {
          type: 'nearby_item_request',
          requestId,
          listingId: match.listingId,
          requestedItem,
          requestLocation,
          listingLocation: match.location,
          distanceKm: Number(match.distanceKm.toFixed(2))
        }
      });
    }

    console.log("Notifications being sent:", notificationMessages);

    return await sendExpoPushMessages(notificationMessages);
  } catch (error) {
    console.error(
      'Nearby notification failed:',
      error
    );

    return 0;
  }
};

const getStartOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const normaliseDate = (date) => {
  const normalisedDate = new Date(date);
  normalisedDate.setHours(0, 0, 0, 0);
  return normalisedDate;
};

const sanitiseMoneyInput = (value) => {
  const cleanedValue = value.replace(/[^0-9.]/g, '');
  const parts = cleanedValue.split('.');

  const wholeNumber = parts[0].slice(0, 5);
  const decimalPart = parts.slice(1).join('').slice(0, 2);

  if (cleanedValue.includes('.')) {
    return `${wholeNumber}.${decimalPart}`;
  }

  return wholeNumber;
};

const isValidMoneyAmount = (value, allowZero = true) => {
  const validFormat = /^\d+(\.\d{1,2})?$/.test(value);

  if (!validFormat) {
    return false;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount > 10000) {
    return false;
  }

  return allowZero ? amount >= 0 : amount > 0;
};

function HubPickerModal({ visible, onClose, onSelect }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

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

          { }
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
    if (Platform.OS === 'android') {
      setShowBorrowPicker(false);
    }

    if (!selectedDate) {
      return;
    }

    const selectedBorrowDate = normaliseDate(selectedDate);
    const today = getStartOfToday();

    if (selectedBorrowDate < today) {
      Alert.alert(
        'Invalid Date',
        'Borrow date cannot be before today.'
      );
      return;
    }

    setBorrowDate(selectedBorrowDate);

    if (normaliseDate(returnDate) < selectedBorrowDate) {
      setReturnDate(selectedBorrowDate);
    }
  };

  const handleReturnDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowReturnPicker(false);
    }

    if (!selectedDate) {
      return;
    }

    const selectedReturnDate = normaliseDate(selectedDate);
    const selectedBorrowDate = normaliseDate(borrowDate);

    if (selectedReturnDate < selectedBorrowDate) {
      Alert.alert(
        'Invalid Date',
        'Return date cannot be before the borrow date.'
      );
      return;
    }

    setReturnDate(selectedReturnDate);
  };

  const handlePostRequest = async () => {
    if (loading) {
      return;
    }

    const trimmedItem = item.trim();
    const trimmedDescription = description.trim();

    const today = getStartOfToday();
    const selectedBorrowDate = normaliseDate(borrowDate);
    const selectedReturnDate = normaliseDate(returnDate);

    if (
      !trimmedItem ||
      !location ||
      !willingToPay ||
      !deposit ||
      !trimmedDescription
    ) {
      Alert.alert(
        'Missing Fields',
        'Please fill out all fields.'
      );
      return;
    }

    if (trimmedItem.length < 2) {
      Alert.alert(
        'Invalid Item',
        'Item name must contain at least 2 characters.'
      );
      return;
    }

    if (trimmedDescription.length < 5) {
      Alert.alert(
        'Invalid Description',
        'Please enter at least 5 characters.'
      );
      return;
    }

    if (selectedBorrowDate < today) {
      Alert.alert(
        'Invalid Date',
        'Borrow date must be today or later.'
      );
      return;
    }

    if (selectedReturnDate < selectedBorrowDate) {
      Alert.alert(
        'Invalid Date',
        'Return date cannot be before the borrow date.'
      );
      return;
    }

    if (!isValidMoneyAmount(willingToPay, false)) {
      Alert.alert(
        'Invalid Amount',
        'Willing to pay must be greater than 0 and can have a maximum of 2 decimal places.'
      );
      return;
    }

    if (!isValidMoneyAmount(deposit, true)) {
      Alert.alert(
        'Invalid Deposit',
        'Security deposit must be between 0 and 10000 and can have a maximum of 2 decimal places.'
      );
      return;
    }

    setLoading(true);

    try {
      const requesterId =
        auth.currentUser?.uid;

      if (!requesterId) {
        Alert.alert(
          'Login Required',
          'You must be logged in to post a request.'
        );

        return;
      }

      const requestDocument =
        await addDoc(
          collection(db, 'requests'),
          {
            userId: requesterId,
            username: username,

            item: trimmedItem,
            itemSearch:
              normaliseItemName(trimmedItem),

            location: location,

            borrowdate:
              formatDateString(borrowDate),

            returndate:
              formatDateString(returnDate),

            returnDateTimestamp:
              Timestamp.fromDate(returnDate),

            willingToPay:
              Number(willingToPay).toFixed(2),

            deposit:
              Number(deposit).toFixed(2),

            description:
              trimmedDescription,

            createdAt:
              serverTimestamp(),

            isDeleted: false,
            status: 'active'
          }
        );

      const notificationCount =
        await notifyNearbyListingOwners({
          requestId:
            requestDocument.id,

          requesterId,

          requestedItem:
            trimmedItem,

          requestLocation:
            location,

          requesterUsername:
            username
        });

      Alert.alert(
        'Success',
        notificationCount > 0
          ? `Your request was posted and ${notificationCount} nearby matching owner${notificationCount === 1 ? '' : 's'} were notified!`
          : 'Your request was posted successfully. No nearby matching listings were found right now.'
      );

      setItem('');
      setLocation('');
      setBorrowDate(new Date());
      setReturnDate(new Date());
      setWillingToPay('');
      setDeposit('');
      setDescription('');
    } catch (error) {
      console.error('Firestore Error: ', error);

      Alert.alert(
        'Database Error',
        'Could not save your post. Make sure your internet is working.'
      );
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
          minimumDate={getStartOfToday()}
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
      <TextInput
        style={styles.input}
        placeholder="Eg: 1.70"
        placeholderTextColor="#a0a0a0"
        value={willingToPay}
        onChangeText={(value) =>
          setWillingToPay(sanitiseMoneyInput(value))
        }
        keyboardType="decimal-pad"
        inputMode="decimal"
        maxLength={8}
      />

      <Text style={styles.label}>Security Deposit:</Text>
      <TextInput
        style={styles.input}
        placeholder="Eg: 12.00"
        placeholderTextColor="#a0a0a0"
        value={deposit}
        onChangeText={(value) =>
          setDeposit(sanitiseMoneyInput(value))
        }
        keyboardType="decimal-pad"
        inputMode="decimal"
        maxLength={8}
      />

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
    if (loading) {
      return;
    }

    const trimmedItem = item.trim();
    const trimmedReturnConditions =
      returnConditions.trim();

    if (
      !trimmedItem ||
      !location ||
      !costPerDay ||
      !deposit ||
      !trimmedReturnConditions
    ) {
      Alert.alert(
        'Missing Fields',
        'Please fill out all fields.'
      );
      return;
    }

    if (trimmedItem.length < 2) {
      Alert.alert(
        'Invalid Item',
        'Item name must contain at least 2 characters.'
      );
      return;
    }

    if (trimmedReturnConditions.length < 5) {
      Alert.alert(
        'Invalid Requirements',
        'Please enter at least 5 characters.'
      );
      return;
    }

    if (!isValidMoneyAmount(costPerDay, false)) {
      Alert.alert(
        'Invalid Cost',
        'Cost per day must be greater than 0.'
      );
      return;
    }

    if (!isValidMoneyAmount(deposit, true)) {
      Alert.alert(
        'Invalid Deposit',
        'Invalid deposit amount.'
      );
      return;
    }

    setLoading(true);

    try {
      const currentUserId = auth.currentUser?.uid;

      if (!currentUserId) {
        Alert.alert(
          'Login Required',
          'Please log in.'
        );
        return;
      }

      await addDoc(
        collection(db, 'listings'),
        {
          userId: currentUserId,
          username: username,

          item: trimmedItem,

          itemSearch:
            normaliseItemName(trimmedItem),

          location: location,

          costPerDay:
            Number(costPerDay).toFixed(2),

          deposit:
            Number(deposit).toFixed(2),

          returnConditions:
            trimmedReturnConditions,

          createdAt:
            serverTimestamp(),

          isDeleted: false,
          status: 'active'
        }
      );

      Alert.alert(
        'Success',
        'Your listing has been posted!'
      );

      setItem('');
      setLocation('');
      setCostPerDay('');
      setDeposit('');
      setReturnConditions('');

    } catch (error) {
      console.error(error);

      Alert.alert(
        'Database Error',
        'Could not save listing.'
      );

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
      <TextInput
        style={styles.input}
        placeholder="Eg: 0.50"
        placeholderTextColor="#a0a0a0"
        value={costPerDay}
        onChangeText={(value) =>
          setCostPerDay(sanitiseMoneyInput(value))
        }
        keyboardType="decimal-pad"
        inputMode="decimal"
        maxLength={8}
      />

      <Text style={styles.label}>Security Deposit:</Text>
      <TextInput
        style={styles.input}
        placeholder="Eg: 10.25"
        placeholderTextColor="#a0a0a0"
        value={deposit}
        onChangeText={(value) =>
          setDeposit(sanitiseMoneyInput(value))
        }
        keyboardType="decimal-pad"
        inputMode="decimal"
        maxLength={8}
      />

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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 34, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, paddingBottom: 12 },
  modalHeaderText: { fontSize: 20, fontWeight: '800', color: '#14004c' },
  modalCloseX: { fontSize: 20, fontWeight: '600', color: '#8e8e93', padding: 4 },
  locationOptionRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f2f2f7' },
  locationOptionText: { fontSize: 16, fontWeight: '600', color: '#333333' },

  modalSearchWrapper: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e5ea', marginBottom: 6 },
  modalSearchInput: { width: '100%', height: 44, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: '#333333', backgroundColor: '#f2f2f7' },
  modalEmptyBox: { paddingVertical: 40, alignItems: 'center' },
  modalEmptyText: { color: '#8e8e93', fontSize: 15, fontWeight: '500' }
});