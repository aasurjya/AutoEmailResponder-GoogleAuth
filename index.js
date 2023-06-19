require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { google } = require('googleapis');

// OAuth configuration
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = 'http://localhost:3000/callback';

const app = express();

// Set up session middleware
app.use(
  session({
    secret: 'your-secret',
    resave: true,
    saveUninitialized: true,
  })
);

// Create OAuth2Client
const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

// Set up routes
app.get('/login', (req, res) => {
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.modify'],
  });
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Store tokens in session
    req.session.tokens = tokens;
    console.log(req.session.tokens);
    console.log(tokens);

    res.send('Authentication successful! You can now close this window.');
  } catch (error) {
    console.error('Error authenticating:', error);
    res.status(500).send('Error occurred during authentication.');
  }
});

// Create Gmail API client
const gmail = google.gmail({ version: 'v1', auth: client });

// Function to check for new emails
async function checkEmails() {
  try {
    // Get the user's email address
    const userInfo = await gmail.users.getProfile({ userId: 'me' });
    const userEmail = userInfo.data.emailAddress;

    // List unread emails
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `is:unread to:${userEmail}`,
    });

    const emails = response.data.messages;

    // Filter out emails that have already been replied to
    const filteredEmails = await Promise.all(
      emails.map(async (email) => {
        const threadId = email.threadId;

        // Check if any emails in the thread have been sent by the user
        const threadResponse = await gmail.users.threads.get({ userId: 'me', id: threadId });
        const threadMessages = threadResponse.data.messages;

        const isReplied = threadMessages.some((message) =>
          message.labelIds.includes('SENT')
        );

        // Return the email if it has no prior replies
        if (!isReplied) {
          return email;
        }
      })
    );

    // Process the filtered emails
    await Promise.all(
      filteredEmails.map(async (email) => {
        if (email) {
          const emailId = email.id;

          // Send a reply to the email
          const replyRequest = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              threadId: email.threadId,
              raw: 'From: "	Aasurjya Bikash Handique" <ahandique8@gmail.com>\n' +
                   'To: ' + userEmail + '\n' +
                   'Subject: Re: ' + email.subject + '\n\n' +
                   'Hi this is automated mail',
            },
          });

          // Add a label to the email and move it to the label
          const labelsResponse = await gmail.users.messages.modify({
            userId: 'me',
            id: emailId,
            requestBody: {
              addLabelIds: ['automail'], // Replace with the actual label ID
              removeLabelIds: ['UNREAD'],
            },
          });
          console.log(emailId);
          console.log(id);
          console.log(userId)

          console.log(`Replied to email ${emailId} and applied labels: ${labelsResponse.data.labelIds}`);
        }
      })
    );
  } catch (error) {
    console.error('Error checking emails:', error);
  }
}

app.listen(3000, () => {
  console.log('Server listening on port 3000');

  // Check for emails when the server starts
  checkEmails();
});
