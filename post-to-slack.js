/* eslint no-param-reassign: 0, function-paren-newline: 0, import/no-unresolved: 0 */
/* globals $H */

const name = 'post to slack';
const token = process.env.SLACK_TOKEN;

require('child_process').execSync(`npm i ${[
  'js-htmlencode',
  'debug',
  'slack',
].join(' ')}`);

const log = require('debug')(`${name}:log`);
const error = require('debug')(`${name}:error`);
const encode = require('js-htmlencode').htmlEncode;
const slack = require('slack');

let channels = [];

log(`Dependencies installed for "${name}" harbor.`);

const renderInput = (values) => {
  values = values || {};

  slack.channels.list({ token }).then((res) => ( channels = res.channels ));

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
      <h5 class="small-8 column">Message to send:</h5>
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
      <textarea
        name=message
        class="small-8 columns slack-message-input"
        placeholder="(empty)"
        required
      >${values.message ? encode(values.message) : ''}</textarea>
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
  let channels = [];
  Object.keys(manifest).forEach((key) => {
    switch (key) {
      case 'message':
        break;
      case 'timestamp':
        break;
      case 'username':
        break;
      default:
        channels.push(`#${key}`);
        break;
    }
  });

  return channels;
}

const getChosenChannelIDs = (manifest) => {
  let channels = [];
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
      default:
        channels.push(manifest[key]);
        break;
    }
  });

  return channels;
}

const renderWorkPreview = (manifest) => {
  let channels = getChosenChannelsPretty(manifest);

  return `
    <h4>
      The following message will be posted${
        manifest.username ?
          ` as username <code>${manifest.username}</code> ` :
          ' '
      }to channel${
        channels.length > 1 ? 's' : ''
      } <code>${channels.join('</code>, <code>')}</code>:
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

const work = (lane, manifest) => {
  let exitCode = 1;
  let channels = getChosenChannelIDs(manifest);
  let username = manifest.username || undefined;
  let text = manifest.message;

  channels.forEach((channel) => {
    slack.chat.postMessage({ token, channel, username, text })
      .then((res) => {
        log(res)
        exitCode = 0;
        manifest.results = manifest.results || [];
        manifest.results.push(res);
      })
      .catch((err) => {
        err(err)
        manifest.errors = manifest.errors || [];
        manifest.errors.push(err);
      })
      .finally(() => $H.call('Lanes#end_shipment', lane, exitCode, manifest))
    ;
  });
};

module.exports = {
  render_input: renderInput,
  render_work_preview: renderWorkPreview,
  register,
  update,
  work,
};
