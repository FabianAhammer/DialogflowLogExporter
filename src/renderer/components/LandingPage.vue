<template>
  <div id="wrapper">
    <main>
      <h1 class="title">
        <span class="small-text">Dia</span>log
        <span class="small-text">flow</span>
        <span>&nbsp;</span>
        Viewer
      </h1>
      <div></div>
      <br>
      <button @click="open()">Dialogflow Login</button>

      <input type="file" value="Load Local File" @change="loadFile">
      <button @click="exportJson()">Export JSON</button>

      <br>
      <br>
      <DynamicScroller
        class="scroller"
        :items="filterConversations(logs.conversations)"
        :min-item-size="10"
        key-field="conversationId"
      >
        <template v-slot="{item, index, active}">
          <DynamicScrollerItem
            :item="item"
            :active="active"
            :data-index="index"
            class="conversation-container"
          >
            <div class="conversation">
              <div
                class="interaction"
                v-for="interaction in item.interactions"
                :key="interaction.id"
              >
                <div
                  class="guest-text"
                  v-html="highlightText(interaction.conversationResponse.queryText)"
                ></div>
                <div class="leonie-text-container">
                  <div
                    class="leonie-text-lazy"
                    v-html="highlightText(interaction.conversationResponse.conversationText)"
                  ></div>
                </div>
                <div class="timestamp">{{ interaction.conversationResponse.timestamp}}</div>
              </div>
            </div>
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>
      <!--
          
      <transition-group name="conversation-list" tag="div">
        <div
          class="conversation"
          v-for="conversation in filterConversations(logs.conversations)"
          :key="conversation.conversationId"
        >
          <div
            class="interaction"
            v-for="interaction in conversation.interactions"
            :key="interaction.id"
          >
            <div
              class="guest-text"
              v-html="highlightText(interaction.conversationResponse.queryText)"
            ></div>
            <div class="leonie-text-container">
              <div
                class="leonie-text-lazy"
                v-observe-visibility="(isVisible, entry) => showText(isVisible, entry, interaction.conversationResponse)"
              >loading...{{interaction.conversationResponse.conversationText}}</div>
            </div>
            
            <div class="timestamp">{{ interaction.conversationResponse.timestamp}}</div>
          </div>
        </div>
      </transition-group>
      -->
      <div class="bottom-bar">
        <button>Previous</button>
        <input type="text" placeholder="Search" v-model="filterText">
        <button>Next</button>
      </div>
    </main>
  </div>
</template>
<script>
import SystemInformation from "./LandingPage/SystemInformation";
import { setInterval, clearInterval } from "timers";
import { readFileSync, writeFile } from "fs";

export default {
  name: "landing-page",
  components: { SystemInformation },
  data() {
    return {
      filterText: "",
      logs: {
        conversations: [
          {
            conversationId: 0,
            interactions: [
              {
                id: "",
                conversationResponse: {
                  queryText: "",
                  conversationText: "",
                  fulfillmentMessages: [
                    {
                      text: {
                        text: [""]
                      }
                    }
                  ],
                  timestamp: ""
                }
              }
            ]
          }
        ]
      }
    };
  },
  methods: {
    loadFile(e) {
      let files = e.target.files || e.dataTransfer.files;
      if (!files.length) return;
      let file = files[0];
      let reader = new FileReader();
      let self = this;
      reader.onload = function(e) {
        var contents = e.target.result;
        self.displayLogs(JSON.parse(contents));
      };
      reader.readAsText(file);
    },
    open() {
      /** @type {BrowserWindowProxy} */
      let dialogflowWindow = window.open(
        "https://console.dialogflow.com/api-client/",
        "_blank",
        "nodeIntegration=no"
      );

      let dialogflowCookies = "";
      let windowMessageCallback = m => {
        dialogflowCookies = m.data;
      };
      window.addEventListener("message", windowMessageCallback, false);

      let closedPoller = setInterval(() => {
        dialogflowWindow.eval(
          `window.opener.postMessage(document.cookie, "*")`
        );

        if (dialogflowWindow.closed) {
          console.log(dialogflowCookies);
          this.requestLogs(dialogflowCookies);
          window.removeEventListener("message", windowMessageCallback, false);
          clearInterval(closedPoller);
        }
      }, 500);
    },
    exportJson() {
      writeFile("leonie_logs.json", JSON.stringify(this.logs), "utf8", () => {
        alert("Exported logs!");
      });
    },
    /**
     * @param {String} toHighlight
     */
    highlightText(toHighlight) {
      if (!toHighlight) return "";

      return toHighlight.replace(
        this.filterText,
        `<span class="highlight">${this.filterText}</span>`
      );
    },
    async requestLogs(cookies) {
      let response = await fetch(
        `https://console.dialogflow.com/api/interactions/conversations2?startTimeMillis=0&endTimeMillis=${Date.now()}&conversationsPerPage=200&interactionsPerConversation=25&matchedToIntent=true&searchBackward=false`,
        {
          method: "get",
          headers: new Headers({
            Cookie: cookies,
            Authorization: "Bearer dde8b027-77dc-46a3-ad4d-d3d10e27ba74"
          }),
          credentials: "include"
        }
      );

      this.displayLogs(await response.json());
    },
    /**
     *
     * @param {{conversations: {conversationId: number, interactions:{id: string, conversationResponse:{queryText:string, timestamp: string, fulfillmentMessages:{text:{text:string[]}}[]}}[]}[]}} logs
     */
    displayLogs(logs) {
      // Get the conversationText
      logs.conversations.forEach(c =>
        c.interactions.forEach(
          interaction =>
            (interaction.conversationResponse.conversationText = this.getText(
              interaction.conversationResponse
            ))
        )
      );

      this.logs = logs;
    },
    filterConversations(conversations) {
      let filter = this.filterText;
      return conversations.filter(conversation => {
        return conversation.interactions.some(interaction => {
          let leonieText = interaction.conversationResponse.queryText;
          let userText = interaction.conversationResponse.conversationText;
          return leonieText.includes(filter) || userText.includes(filter);
        });
      });
    },
    getText(conversationResponse) {
      if (!conversationResponse) return;

      let fulfillmentMessages = conversationResponse.fulfillmentMessages;
      if (!fulfillmentMessages || !fulfillmentMessages[0].text.text[0]) return;
      let jsonResponse = JSON.parse(fulfillmentMessages[0].text.text[0])[0];

      let text = "";
      if (jsonResponse.speech) {
        text = jsonResponse.speech;
      } else if (jsonResponse.payload) {
        let content = jsonResponse.payload.content;
        if (content && content.text) {
          text = content.text;
        } else {
          text = JSON.stringify(jsonResponse);
        }
      } else {
        text = JSON.stringify(jsonResponse);
      }

      return text;
    }
  }
};
</script>



<style>
@import url("https://fonts.googleapis.com/css?family=Source+Sans+Pro");
@import "~vue-virtual-scroller/dist/vue-virtual-scroller.css";

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: "Source Sans Pro", sans-serif;
}

#wrapper {
  /* background: radial-gradient(
    ellipse at top left,
    rgba(255, 255, 255, 1) 40%,
    rgba(229, 229, 229, 0.9) 100%
  );
  height: 100vh;
  width: 100vw;*/
  padding: 60px 80px;
}

.title {
  color: #2c3e50;
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 6px;
  display: flex;
}

button {
  font-size: 0.8em;
  cursor: pointer;
  outline: none;
  padding: 0.75em 2em;
  border-radius: 2em;
  display: inline-block;
  color: #fff;
  background-color: #4fc08d;
  transition: all 0.15s ease;
  box-sizing: border-box;
  border: 1px solid #4fc08d;
}
.small-text {
  font-size: 0.6em;
  color: grey;

  line-height: 2em;
}

.title .small-text {
  transition: font-size 0.5s;
}
.title:hover .small-text {
  font-size: 1em;
  line-height: initial;
}
.conversation-container {
  padding-bottom: 10px;
}
.conversation {
  border: 2px solid darkgrey;
  border-radius: 8px;
  overflow: hidden;
}

.interaction:nth-child(odd) {
  background-color: rgb(240, 240, 240);
}
.interaction:nth-child(even) {
  background-color: white;
}
.guest-text {
  background-color: rgba(255, 0, 0, 0.5);
  font-size: 1.1em;
}
.leonie-text-container {
  /*height: 3em;
  overflow-y: auto;*/
}
.timestamp {
  font-size: 0.8em;
  color: rgb(90, 90, 90);
}

.bottom-bar {
  position: fixed;
  bottom: 0px;
  left: 0px;
  right: 0px;
  height: 3.5em;
  border-top: 1px solid lightgrey;
  display: flex;
  justify-content: space-between;
  padding: 0.5em;
  background-color: white;
}
input[type="text"] {
  width: 30em;
}
.highlight {
  background-color: gold;
}
.scroller {
  height: 100%;
}
</style>
