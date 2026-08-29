# NUS LendIT

**Need it now? LendIT.**

NUS LendIT is a cross-platform peer-to-peer equipment-sharing application developed for the NUS student community as part of **NUS Orbital 2026**. It helps students lend, borrow and request items through a secure, campus-focused platform.

## Features

- **NUS-only accounts:** Registration is restricted to verified `@u.nus.edu` email addresses.
- **Listings and requests:** Students can offer equipment for lending or request items they need.
- **Search and discovery:** Browse and search available listings and student requests.
- **Campus locations:** Select from predefined NUS landmarks, faculties, halls and residences.
- **Interactive map:** View listings and requests as markers on a campus map.
- **Real-time messaging:** Communicate directly with lenders and borrowers through in-app chat.
- **Image sharing:** Send compressed images through conversations.
- **OTP transactions:** Verify item handovers using a one-time password transaction process.
- **Push notifications:** Receive updates for messages, nearby item requests and return reminders.
- **Nearby matching:** Notify relevant lenders when a matching item is requested within approximately 500 metres.
- **User ratings:** View user ratings and provide feedback after transactions.
- **Activity management:** Review and manage personal listings, requests and transactions.
- **Password recovery:** Reset forgotten passwords through Firebase Authentication.

## Technology Stack

- **React Native** - Cross-platform mobile application development
- **Expo SDK 54** - Development, testing and deployment
- **React Navigation** - Stack and bottom-tab navigation
- **Firebase Authentication** - Account registration, login and email verification
- **Cloud Firestore** - Real-time application data and messaging
- **Expo Notifications** - Push notifications and scheduled return reminders
- **React Native Maps** - Interactive campus maps and location markers
- **AsyncStorage** - Persistent authentication state
- **Expo Image Picker** - Selecting images from the device
- **Expo Image Manipulator** - Compressing images before sending
- **EAS** - Expo application builds and updates
- **JavaScript** - Primary programming language

## Getting Started

### Prerequisites

Install the following before running the application:

- [Node.js](https://nodejs.org/)
- npm
- [Expo Go](https://expo.dev/go), an Android emulator or an iOS simulator
- A Firebase project with Authentication and Firestore enabled

### Installation

Clone the repository:

```bash
git clone https://github.com/Ryan5246/NUSLendIT.git
cd NUSLendIT
```

Install the application dependencies:

```bash
npm install
```

### Environment Configuration

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

Obtain these values from your Firebase project settings.

> Do not commit your `.env` file or any private credentials to version control.

### Firebase Setup

In the Firebase Console:

1. Enable **Email/Password Authentication**.
2. Create a **Cloud Firestore** database.
3. Configure appropriate Firestore security rules and indexes.
4. Add the Firebase configuration values to the `.env` file.
5. Ensure notification permissions are enabled when testing on a mobile device.

### Running the Application

Start the Expo development server:

```bash
npm start
```

Run on Android:

```bash
npm run android
```

Run on iOS:

```bash
npm run ios
```

Run the web version:

```bash
npm run web
```

Some features, including native notifications and maps, may work best on a physical Android or iOS device.

## Project Structure

```text
NUSLendIT/
|-- assets/                      # Logos, icons and application images
|-- functions/                   # Firebase Cloud Functions configuration
|-- screens/
|   |-- HomeScreen.js            # Welcome, login and registration
|   |-- DashboardScreen.js       # Main application dashboard
|   |-- SearchScreen.js          # Listings and request discovery
|   |-- PostScreen.js            # Creating listings and requests
|   |-- MapsScreen.js            # Campus map and item markers
|   |-- ChatListScreen.js        # User conversation list
|   |-- ChatScreen.js            # Messages and transaction actions
|   |-- OTPScreen.js             # OTP transaction verification
|   |-- PostOTPScreen.js         # OTP creation and confirmation
|   |-- ProfileActivityScreen.js # User activity management
|   |-- SetUsernameScreen.js     # Username configuration
|   `-- VerifyScreen.js          # Transaction verification
|-- utils/
|   `-- notifications.js         # Push notifications and return reminders
|-- App.js                       # Authentication and root navigation
|-- TabNavigator.js              # Main tab navigation
|-- ChatStackNavigator.js        # Chat navigation
|-- firebaseConfig.js            # Firebase initialisation
|-- app.json                     # Expo application configuration
|-- eas.json                     # Expo Application Services configuration
`-- package.json                 # Dependencies and scripts
```

## Main User Flow

1. Register using an official NUS student email address.
2. Verify the account through the email verification link.
3. Create a username and enter the application.
4. Post an item for lending or create a request for something needed.
5. Search for matching listings or explore items using the campus map.
6. Contact another student through the real-time chat.
7. Confirm the handover using the OTP transaction process.
8. Receive return reminders and complete the transaction.
9. Provide feedback about the other user.

## Available Scripts

| Command | Description |
|---|---|
| `npm start` | Starts the Expo development server |
| `npm run android` | Opens the application on Android |
| `npm run ios` | Opens the application on iOS |
| `npm run web` | Opens the web version |

## Firebase Functions

The `functions` directory contains the Firebase Cloud Functions configuration and uses **Node.js 24**.

Install its dependencies separately:

```bash
cd functions
npm install
```

Run the Firebase Functions emulator:

```bash
npm run serve
```

Deploy configured functions:

```bash
npm run deploy
```

## Purpose

NUS LendIT promotes resource sharing and reduces unnecessary purchases by connecting students who own useful equipment with students who temporarily need it. Its NUS-only authentication, campus-based locations, real-time communication and OTP verification provide a focused and accountable sharing experience.

## Repository

Project source code: [github.com/Ryan5246/NUSLendIT](https://github.com/Ryan5246/NUSLendIT)
