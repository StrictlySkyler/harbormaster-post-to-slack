/* eslint
no-param-reassign: 0,
function-paren-newline: 0,
import/no-unresolved: 0,
no-unused-vars: ["error", {"args": "after-used"}]
*/
/* globals $H */

const name = 'post to slack';
const token = process.env.SLACK_TOKEN;

require('child_process').execSync(`npm i ${[
  'js-htmlencode',
  'debug',
  'slack',
  'lodash',
].join(' ')}`);

const log = require('debug')(`${name}:log`);
const error = require('debug')(`${name}:error`);
const encode = require('js-htmlencode').htmlEncode;
const slack = require('slack');
const _ = require('lodash');

let channels = [];
let users = [];

log(`Dependencies installed for "${name}" harbor.`);

const renderInput = (values) => {
  values = values || {};

  slack.channels.list({ token })
    .then((res) => ( channels = res.channels ))
    .catch((err) => error(err))
  ;
  slack.users.list({ token })
    .then((res) => {
      let latest_users = [];
      res.members.forEach((user) => ( latest_users.push(user) ));
      users = latest_users;
    })
    .catch((err) => error(err))
  ;

  return `
    <style>
      .slack-channel-list li { list-style-type: decimal; }
      .slack-channel-list input { margin-bottom: 0; }
      .slack-message-input { resize: vertical; width: 625px; }
      .slack-username { display: inline-block; width: 200px; }
    </style>
    <h4>Welcome to your Slack harbor!</h4>
    <div class="row">
      <h5 class="small-3 column">Channels to use:</h5>
      <h5 class="small-3 column">Users to message:</h5>
      <h5 class="small-5 column">Message to send:</h5>
    </div>
    <div class="row">
      <ol class="slack-channel-list small-3 columns">
        ${
          channels.map((chan) => {
            return `<li>
              <label>
                <input
                  name="${chan.name}"
                  type=checkbox
                  value="${chan.id}"
                  ${values && values[chan.name] ? 'checked' : ''}
                >
                ${chan.name}
              </label>
            </li>\n`;
          }).join('')
        }
      </ol>
      <ol class="slack-user-list small-3 column">
        ${
          users.map((user) => {
            return `<li>
              <label>
                <input
                  name="${user.name}"
                  type=checkbox
                  value="${user.id}"
                  ${values && values[user.name] ? 'checked' : ''}
                >
                ${user.name}
              </label>
            </li>\n`;
          }).join('')
        }
      </ol>
      <div class="small-5 column">
        <textarea
          name=message
          class="slack-message-input"
          placeholder="(empty)"
          required
        >${values.message ? encode(values.message) : ''}</textarea>
      </div>
    </div>
    <label>
      <span>As username (optional):</span>
      <input
        class="slack-username"
        type=text
        name=username
        value=${values.username ? values.username : ''}
      >
    </label>
  `;
};

const getChosenChannelsPretty = (manifest) => {
  let prettyChannels = [];
  Object.keys(manifest).forEach((key) => {
    switch (key) {
      case 'message':
        break;
      case 'timestamp':
        break;
      case 'username':
        break;
      default:
        prettyChannels.push(`#${key}`);
        break;
    }
  });

  return prettyChannels;
};

const getChosenChannelIDs = (manifest) => {
  let channelIds = [];
  Object.keys(manifest).forEach((key) => {
    switch (key) {
      case 'message':
        break;
      case 'timestamp':
        break;
      case 'username':
        break;
      case 'shipment_start_date':
        break;
      case 'shipment_id':
        break;
      case 'prior_manifest':
        break;
      default:
        channelIds.push(manifest[key]);
        break;
    }
  });

  return channelIds;
};

const renderWorkPreview = (manifest) => {
  let prettyChannels = getChosenChannelsPretty(manifest);

  return `
    <h4>
      The following message will be posted${
        manifest.username ?
          ` as username <code>${manifest.username}</code> ` :
          ' '
      }to channel${
        prettyChannels.length > 1 ? 's' : ''
      } <code>${prettyChannels.join('</code>, <code>')}</code>:
    </h4>
    <pre><code>${manifest.message}</code></pre>
  `;
};

const register = () => name;

const update = (lane, values) => {
  if (! values.message) return false;

  if (! getChosenChannelIDs(values).length) return false;

  return true;
};

const fillReferenceText = (manifest, text) => {
  const referenceRegex = /\[\[([a-zA-Z0-9_.:-]+)\]\]/g;
  const strictReferenceRegex = /\[\[\[([a-zA-Z0-9_.:-]+)\]\]\]/g;

  const referencedValueText = text
    .replace(strictReferenceRegex, (match, target) => {
      const value = JSON.stringify(_.get(manifest, target), null, '\t');
      return value;
    }).replace(referenceRegex, (match, target) => {
      const value = _.get(manifest, target);
      return value;
    });
  return encode(referencedValueText);
};


const work = (lane, manifest) => {
  let exitCode;
  let channelIds = getChosenChannelIDs(manifest);
  let username = manifest.username;
  let text = fillReferenceText(manifest, manifest.message);
  let promises = [];

  channelIds.forEach((channel) => {
    promises.push(slack.chat.postMessage({ token, channel, username, text })
      .then((res) => {
        log(channel, res);
        exitCode = exitCode ? exitCode : 0;
        manifest.results = manifest.results || [];
        manifest.results.push(res);
      })
      .catch((err) => {
        exitCode = exitCode || 1;
        error(channel, err);
        manifest.errors = manifest.errors || [];
        manifest.errors.push(err);
      })
    );
  });

  Promise.all(promises).then((values) => {
    log(channelIds, values);
    $H.call('Lanes#end_shipment', lane, exitCode, manifest);
  });
};

module.exports = {
  render_input: renderInput,
  render_work_preview: renderWorkPreview,
  register,
  update,
  work,
};


