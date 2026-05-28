import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  SafeAreaView,
  Text,
} from 'react-native';

import MapView, {
  PROVIDER_GOOGLE,
  Marker,
} from 'react-native-maps';

import * as Location from 'expo-location';

import {
  doc,
  setDoc,
  collection,
  onSnapshot,
} from 'firebase/firestore';

import {
  getAuth,
} from 'firebase/auth';

import { db } from '../firebaseConfig';

const auth = getAuth();

export default function MapsScreen() {

  const [permissionGranted, setPermissionGranted] = useState(false);

  const [userLocation, setUserLocation] = useState({
    latitude: 1.2952,
    longitude: 103.7766,
  });

  const [liveUsers, setLiveUsers] = useState([]);

  const currentUserId = auth.currentUser?.uid;

  const [markerList] = useState([

    {
      id: 1,
      title: 'FOS',
      description: '',
      latitude: 1.2996,
      longitude: 103.7805,
    },

    {
      id: 2,
      title: 'CDE',
      description: '',
      latitude: 1.3009,
      longitude: 103.7719,
    },

    {
      id: 3,
      title: 'USC',
      description: '',
      latitude: 1.2974,
      longitude: 103.7740,
    },

    {
      id: 4,
      title: 'YIH',
      description: '',
      latitude: 1.2988,
      longitude: 103.7749,
    },

  ]);

  useEffect(() => {

    getLocationPermission();

  }, []);

  // LIVE FIREBASE USER LISTENER
  useEffect(() => {

    const unsubscribe = onSnapshot(

      collection(db, "users"),

      (snapshot) => {

        const users = [];

        snapshot.forEach((document) => {

          const data = document.data();

          // DON'T SHOW CURRENT USER AS BLUE MARKER
          if (document.id !== currentUserId) {

            users.push({
              id: document.id,
              ...data,
            });

          }

        });

        setLiveUsers(users);

      }
    );

    return () => unsubscribe();

  }, [currentUserId]);

  // LIVE LOCATION TRACKING
  async function getLocationPermission() {

    const { status } =
      await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {

      setPermissionGranted(false);

      return;
    }

    setPermissionGranted(true);

    await Location.watchPositionAsync(

      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 2,
      },

      async (location) => {

        const latitude = location.coords.latitude;

        const longitude = location.coords.longitude;

        setUserLocation({
          latitude,
          longitude,
        });

        // SAVE LIVE LOCATION TO FIREBASE
        if (!currentUserId) return;

        await setDoc(
          doc(db, "users", currentUserId),
          {
            latitude,
            longitude,
            updatedAt: Date.now(),
          }
        );
      }
    );
  }

  if (!permissionGranted) {

    return (

      <SafeAreaView style={styles.center}>

        <Text>
          Please allow location permission
        </Text>

      </SafeAreaView>

    );
  }

  return (

    <SafeAreaView style={styles.container}>

      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}

        showsUserLocation={true}

        followsUserLocation={true}

        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >

        {/* STATIC NUS LOCATIONS */}
        {markerList.map((marker) => (

          <Marker
            key={marker.id}

            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}

            title={marker.title}

            description={marker.description}

            tracksViewChanges={false}
          />

        ))}

        {/* LIVE USERS */}
        {liveUsers.map((user) => (

          <Marker
            key={user.id}

            coordinate={{
              latitude: user.latitude,
              longitude: user.longitude,
            }}

            title={"User"}

            description={user.id}

            pinColor="blue"
          />

        ))}

      </MapView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
  },

  map: {
    flex: 1,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

});