const { google } = require('googleapis');
const readline = require('readline');

// Define Gmail API credentials and scopes

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

// Create an OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uri
);

// Generate the authentication URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
});

console.log('Authorize this app by visiting this URL:', authUrl);

// Handle the OAuth2 callback
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the authorization code from the callback URL: ', (code) => {
  // Exchange the authorization code for access and refresh tokens
  oAuth2Client.getToken(code, (err, tokens) => {
    if (err) {
      console.error('Error retrieving access token:', err);
      return;
    }

    oAuth2Client.setCredentials(tokens);

    // Start checking for new emails in random intervals
    setInterval(checkEmailsAndSendReplies, getRandomInterval(45000, 120000));
  });
});

// Function to check for new emails and send replies
async function checkEmailsAndSendReplies() {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // Retrieve the list of unread emails
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
    });

    const messages = res.data.messages;

    if (messages && messages.length > 0) {
      for (const message of messages) {
        // Check if the email thread has no prior replies
        const threadId = message.threadId;
        const thread = await gmail.users.threads.get({ userId: 'me', id: threadId });
        const hasReplies = thread.data.messages.some((msg) => msg.labelIds.includes('SENT'));

        if (!hasReplies) {
          // Compose the reply message
          const replyMessage = {
            raw: createReplyMessage(thread.data.messages[0].payload.headers),
          };

          // Send the reply
          await gmail.users.messages.send({
            userId: 'me',
            resource: replyMessage,
          });

          // Add a label to the email and move it
          const labelId = await createLabelIfNeeded(gmail, 'AutoReplied');
          await gmail.users.messages.modify({
            userId: 'me',
            id: message.id,
            resource: {
              addLabelIds: [labelId],
              removeLabelIds: ['INBOX'],
            },
          });

          console.log('Replied to an email and moved it to the AutoReplied label.');
        }
      }
    }
  } catch (error) {
    console.error('Error occurred:', error);
  }
}

// Function to create a reply message
function createReplyMessage(headers) {
  const messageId = headers.find((header) => header.name === 'Message-ID').value;
  const from = headers.find((header) => header.name === 'From').value;

  const reply = `Thank you for your email. This is an automated reply.`;

  const replyMessage = `From: Aasurjya <corp.asurjya@gmail.com>
To: ${from}
In-Reply-To: ${messageId}
References: ${messageId}
Subject: Re: ${headers.find((header) => header.name === 'Subject').value}

${reply}`;

  return Buffer.from(replyMessage).toString('base64');
}

// Function to create a label if it doesn't exist
async function createLabelIfNeeded(gmail, labelName) {
  const res = await gmail.users.labels.list({ userId: 'me' });
  const labels = res.data.labels;

  const existingLabel = labels.find((label) => label.name === labelName);

  if (existingLabel) {
    return existingLabel.id;
  } else {
    const newLabel = await gmail.users.labels.create({
      userId: 'me',
      resource: {
        label: {
          name: labelName,
          messageListVisibility: 'show',
          labelListVisibility: 'labelShow',
        },
      },
    });

    return newLabel.data.id;
  }
}

// Function to generate random intervals
function getRandomInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
