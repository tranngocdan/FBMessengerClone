import React from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Picker,
  Text,
  Platform,
  Linking
} from "react-native";
import { connect } from "react-redux";
import { GiftedChat } from "react-native-gifted-chat";
import Chatkit from "@pusher/chatkit";
import axios from "axios";
import Icon from "@components/Icon";
import MapView, { Marker } from "react-native-maps";
var ImagePicker = require("react-native-image-picker");
import Message from "../../components/ChatView/Message";
import {
  SECRET_KEY,
  CHATKIT_TOKEN_PROVIDER_ENDPOINT,
  CHATKIT_INSTANCE_LOCATOR,
  IMAGE_UPLOAD_URL,
  IMAGE_API_KEY
} from "@config/chatConfig";
import { LANGUAGES } from "@config/languageArr";
import { url } from '@config/loopBackConfig';

class ChatScreen extends React.Component {
  state = {
    messages: [],
    id: "",
    roomid: "",
    selectFromPicker: false,
    selectToPicker: false,
    fromLanguage: "vi",
    toLanguage: "en",
    composingText: "",
    pendingImages: [],
    isUploadingImage: false
  };

  constructor(props) {
    super(props);
    this.renderCustomView = this.renderCustomView.bind(this);
    this.renderMessage = this.renderMessage.bind(this);
    this.uploadImage = this.uploadImage.bind(this);
    this.shareImage = this.shareImage.bind(this);
    this.shareLocation = this.shareLocation.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.onSendText = this.onSendText.bind(this);
    this.onUploadImageFinish = this.onUploadImageFinish.bind(this);
  }

  componentDidMount() {
    const id = this.props.navigation.getParam("id");
    const roomid = this.props.navigation.getParam("roomid");
    this.setState({ id, roomid });

    // This will create a `tokenProvider` object. This object will be later used to make a Chatkit Manager instance.
    const tokenProvider = new Chatkit.TokenProvider({
      url: CHATKIT_TOKEN_PROVIDER_ENDPOINT
    });

    // This will instantiate a `chatManager` object. This object can be used to subscribe to any number of rooms and users and corresponding messages.
    // For the purpose of this example we will use single room-user pair.
    const chatManager = new Chatkit.ChatManager({
      instanceLocator: CHATKIT_INSTANCE_LOCATOR,
      userId: id,
      tokenProvider: tokenProvider
    });

    // In order to subscribe to the messages this user is receiving in this room, we need to `connect()` the `chatManager` and have a hook on `onNewMessage`. There are several other hooks that you can use for various scenarios. A comprehensive list can be found [here](https://docs.pusher.com/chatkit/reference/javascript#connection-hooks).
    chatManager
      .connect({
        onAddedToRoom: room => {
          console.log(`Added to room ${room.id}`);
        }
      })
      .then(currentUser => {
        this.currentUser = currentUser;
        this.currentUser.subscribeToRoom({
          roomId: roomid,
          hooks: {
            onNewMessage: this.onReceive.bind(this)
          }
        });
      })
      .catch(err => {
        console.log("Error on connection", err);
      });
  }

  // Handle message sent from server
  onReceive(data) {
    const { id, senderId, text, createdAt, attachment } = data;

    // Initialize base message
    const incomingMessage = {
      _id: id,
      createdAt: new Date(createdAt),
      user: {
        _id: senderId,
        name: senderId
      }
    };

    // Add custom props to base message for displaying differnt types of message
    try {
      const object = JSON.parse(text);
      if (object.type === "text") {
        incomingMessage.text = object.data.text;
      } else if (object.type === "image") {
        incomingMessage.image = object.data.link;
      } else if (object.type === "location") {
        const location = {
          latitude: object.data.latitude,
          longitude: object.data.longitude
        };
        incomingMessage.location = location;
      } else {
        incomingMessage.text = text;
      }
    } catch (error) {
      // The JSON parse exception means this is a simple text message. So we set text to it.
      incomingMessage.text = text;
    }

    this.setState(previousState => ({
      messages: GiftedChat.append(previousState.messages, incomingMessage)
    }));
  }

  // Send simple text message
  onSendText([message]) {
    const textMessage = {
      text: message.text,
      roomId: this.state.roomid
    };
    this.currentUser.sendMessage(textMessage);
    this.setState({
      composingText: ""
    });
  }

  // Send image and location message
  sendMessage(message) {
    this.currentUser.sendMessage(message);
  }

  // Create and send image message
  shareImage(url) {
    const textToSend = this.getImageMessageData(url);
    const message = {
      text: textToSend,
      roomId: this.state.roomid
    };
    this.sendMessage(message);
  }

  // Create and send location message
  shareLocation() {
    navigator.geolocation.getCurrentPosition(
      position => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const textToSend = this.getLocationMessageData(latitude, longitude);
        const message = {
          text: textToSend,
          roomId: this.state.roomid
        };
        this.sendMessage(message);
      },
      error => alert(error.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  }

  // Create text message object
  getTextMessageData(text) {
    const message = {
      type: "text",
      data: {
        text: text
      }
    };
    return JSON.stringify(message);
  }

  // Create image message object
  getImageMessageData(link) {
    const message = {
      type: "image",
      data: {
        link: link
      }
    };
    return JSON.stringify(message);
  }

  // Create location message object
  getLocationMessageData(latitude, longitude) {
    const message = {
      type: "location",
      data: {
        latitude: latitude,
        longitude: longitude
      }
    };
    return JSON.stringify(message);
  }

  // Handle back button
  onGoBack() {
    this.props.dispatch({ type: "GO_BACK" });
  }

  // Show attach image options
  onAttachImage = () => {
    var options = {
      title: "Select Photo",
      customButtons: [{ name: "fb", title: "Choose Photo from Facebook" }],
      storageOptions: {
        skipBackup: true,
        path: "images"
      }
    };
    ImagePicker.showImagePicker(options, response => {
      if (response.didCancel) {
        console.log("User cancelled image picker");
      } else if (response.error) {
        console.log("ImagePicker Error: ", response.error);
      } else if (response.customButton) {
        console.log("User tapped custom button: ", response.customButton);
      } else {
        this.setState(
          {
            pendingImages: [...this.state.pendingImages, response.data]
          },
          () => {
            if (this.state.pendingImages.length == 1) {
              this.uploadImage(this.state.pendingImages[0]);
            }
          }
        );
      }
    });
  };

  // Upload image to server
  uploadImage(base64) {
    if (!this.state.isUploadingImage) {
      this.setState({ isUploadingImage: true }, () => {
        axios
          .post(
            IMAGE_UPLOAD_URL,
            {
              image: base64
            },
            {
              headers: {
                Authorization: "Client-ID " + IMAGE_API_KEY
              }
            }
          )
          .then(response => {
            // Share image when success
            if (response.status === 200) {
              const url = response.data.data.link;
              this.shareImage(url);
            }
            this.onUploadImageFinish();
          })
          .catch(error => {
            console.log("Can not upload image: " + error);
            this.onUploadImageFinish();
          });
      });
    }
  }

  // Remove image data from pending images whether the upload task is succeeded for failed
  onUploadImageFinish() {
    let pendingImages = this.state.pendingImages;
    pendingImages.splice(0, 1);
    if (pendingImages.length === 0) {
      this.setState({ pendingImages, isUploadingImage: false });
    } else {
      this.setState({ pendingImages, isUploadingImage: true }, () => {
        this.uploadImage(pendingImages[0]);
      });
    }
  }

  // Custom location message's view. Click on it to view the map in the Map Kit.
  renderCustomView = props => {
    if (props.currentMessage.location) {
      const latitude = props.currentMessage.location.latitude;
      const longitude = props.currentMessage.location.longitude;
      return (
        <TouchableOpacity
          onPress={() => {
            const url = Platform.select({
              ios: `http://maps.apple.com/?ll=${latitude},${longitude}`,
              android: `http://maps.google.com/?q=${latitude},${longitude}`
            });
            Linking.canOpenURL(url)
              .then(supported => {
                if (supported) {
                  return Linking.openURL(url);
                }
              })
              .catch(err => {
                console.error("Can not open map", err);
              });
          }}
        >
          <MapView
            style={styles.mapView}
            provider="google"
            initialRegion={{
              latitude: latitude,
              longitude: longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker
              coordinate={{
                latitude: latitude,
                longitude: longitude
              }}
            />
          </MapView>
        </TouchableOpacity>
      );
    }

    return null;
  };

  // Custom message's view
  renderMessage(props) {
    return <Message
    {...props} />
  }

  renderChatFooter(props) {
    return (
      <View>
        <View style={styles.rawmessbox}>
          <View style={styles.boxbuttontranslate}>
            <Icon
              name="image"
              type="fontawesome"
              onPress={this.onAttachImage}
              style={{ marginRight: 8 }}
            />
            <Icon name="location" type="entypo" onPress={this.shareLocation} />
          </View>
        </View>
      </View>
    );
  }

  render() {
    return (
      <View style={styles.container}>
        <GiftedChat
          text={this.state.composingText}
          messages={this.state.messages}
          onSend={messages => this.onSendText(messages)}
          user={{
            _id: this.state.id
          }}
          onInputTextChanged={text => {
            this.setState({ composingText: text });
          }}
          renderChatFooter={this.renderChatFooter.bind(this)}
          renderCustomView={this.renderCustomView}
          renderMessage={this.renderMessage}
        />

        <TouchableOpacity
          style={styles.touchBack}
          onPress={() => this.onGoBack()}
        >
          <Image
            source={require("@assets/images/icons8-back-filled-100.png")}
            style={styles.backImage}
          />
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  touchBack: {
    width: 30,
    height: 30,
    position: "absolute",
    zIndex: 1
  },
  backImage: {
    width: 30,
    height: 30,
    top: 30,
    left: 10
  },
  footerselectlang: {
    flexDirection: "row",
    width: "100%",
    height: 40,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#707070"
  },
  translatelabel: {
    flex: 2.5,
    marginLeft: 3,
    fontSize: 14
  },
  touchfrom: {
    flex: 2.2,
    marginLeft: 5,
    backgroundColor: "white",
    height: 25,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center"
  },
  to: {
    flex: 0.5,
    marginLeft: 8,
    fontSize: 14
  },
  rawmessage: {
    height: 40,
    width: "100%",
    backgroundColor: "white",
    borderRadius: 5,
    justifyContent: "center",
    paddingLeft: 5,
    justifyContent: "center",
    fontSize: 16
  },
  rawmessbox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 3
  },
  boxbuttontranslate: {
    flexDirection: "row",
    marginLeft: 8,
    marginRight: 8,
    height: 40,
    justifyContent: "center",
    alignItems: "center"
  },
  mapView: {
    width: 150,
    height: 100,
    borderRadius: 13,
    margin: 3
  }
});

export default connect()(ChatScreen);
