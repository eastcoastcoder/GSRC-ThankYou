// This is on a trigger which runs once per day at 8:27AM
// Starts parsing from Summary Emails, then Renewal Emails afterwards
function init() {
  const label = GmailApp.getUserLabelByName('GSRC Membership Summary');
  const membershipObj = {};
  for (const summaryThread of label.getThreads()) {
    for (const message of summaryThread.getMessages()) {
      const plainMessage = message.getPlainBody();
      const membershipArr = plainMessage.split('\r\n').filter(d => d.includes('#'));
      for (const membership of membershipArr) {
        const [firstName, lastName] = membership.split(' ');
        if (!membershipObj[lastName]) {
          membershipObj[lastName] = [];
        }
        membershipObj[lastName].push({ name: `${firstName} ${lastName}`, isRenewal: false, summaryThread });
      }
    }
  }
  initRenewalEmail(membershipObj);
}

function initRenewalEmail(membershipObj) {
  let hasNewMembers = null;
  const pageAccessToken = getPageAccessToken();
  const label = GmailApp.getUserLabelByName('GSRC Membership Renewal');
  for (const renewalThread of label.getThreads()) {
    for (const message of renewalThread.getMessages()) {
      const plainMessage = message.getPlainBody();
      const membershipType = getMembershipType(plainMessage);
      if (!membershipType) {
        // Some error occured
        continue;
      }
      const renewedMembersSection = plainMessage.split(`${membershipType}\r\n`)[2];
      const [renewedMemeber] = renewedMembersSection
        .split('$')[0]
        .split('*')
        .map(d => d.trim())
        .filter(d => d);
      // Since rewnewal, always last name is assumed from first member
      const [, lastName] = renewedMemeber.split(' ');
      if (!membershipObj[lastName]) {
        // Membership summary has not yet arrived or error state
        continue;
      }
      membershipObj[lastName] = membershipObj[lastName].map(d => ({ ...d, isRenewal: true, renewalThread }));
    }
  }
  for (const finalMember of Object.keys(membershipObj)) {
    const memberGroup = membershipObj[finalMember];
    const postString = getPostString(memberGroup);
    console.log(postString);
    if (pageAccessToken) {
      if (!isDev) {
        postToFacebook(pageAccessToken, postString);
        cleanupLabels(memberGroup);
      }
      // This email has been processed, remove each label so not processed again
      hasNewMembers = true;
    } else {
      hasNewMembers = false;
    }
  }
  const numberOfNewMembers = Object.keys(membershipObj).length;
  const actionText =
    numberOfNewMembers === 0 ? 'there were no new members' : `thanked ${numberOfNewMembers} new members`;
  if (numberOfNewMembers > 0) {
    if (needsReview) {
      reviewDraft();
    }
    if (!hasNewMembers) {
      GmailApp.sendEmail(
        DEV_EMAIL,
        `${isDev ? '[Develop]' : '[Prod]'} GSRC Thank You Posts`,
        `Script executed, an error may have occured or this was a test`
      );
    }
  }
  GmailApp.sendEmail(
    DEV_EMAIL,
    `${isDev ? '[Develop]' : '[Prod]'} GSRC Thank You Posts`,
    `Script executed, ${actionText}`
  );
}

/* Email Block Start */
// Used in FB in the event of an error
function sendErrorEmail() {
  GmailApp.sendEmail(DEV_EMAIL, '[ERROR] GSRC Thank You Posts', 'The token is broken :-(\nGo fix it pls');
}

const reviewDraft = () => {
  const toBeNotifiedStr = toBeNotifiedEmailArr.join(', ');
  GmailApp.sendEmail(
    toBeNotifiedStr,
    'GSRC Thank You Posts',
    "New Thank You's are ready for posting!\nPlease check for errors and if all looks correct, select Publish Now from the draft page here:\nhttps://business.facebook.com/latest/posts/draft_posts?asset_id=204391776753"
  );
};

/* Email Block End */

function cleanupLabels(memberGroup) {
  const summaryLabel = GmailApp.getUserLabelByName('GSRC Membership Summary');
  const renewalLabel = GmailApp.getUserLabelByName('GSRC Membership Renewal');
  const [{ summaryThread, renewalThread }] = memberGroup;
  summaryThread?.removeLabel(summaryLabel);
  renewalThread?.removeLabel(renewalLabel);
}

function getMembershipType(plainMessage) {
  if (plainMessage.includes('Membership Level: Family Membership')) return 'Family Membership';
  if (plainMessage.includes('Membership Level: Individual Membership')) return 'Individual Membership';
  return false;
}

function getPostString(membersArr) {
  const { isRenewal } = membersArr[0];
  let membersString = '';
  let firstName = '';
  let lastName = '';
  let hashTagText = '';
  if (membersArr.length === 1) {
    [firstName] = membersArr[0].name.split(' ');
    membersString = membersArr[0].name;
    hashTagText = firstName.toLocaleLowerCase();
  }
  if (membersArr.length === 2) {
    const [firstPerson, secondPerson] = membersArr;
    // Chop off first person's last name
    [, lastName] = firstPerson.name.split(' ');
    const [firstPersonFirstName] = firstPerson.name.split(' ');
    const [secondPersonFirstName] = secondPerson.name.split(' ');
    membersString = `${firstPersonFirstName} and ${secondPersonFirstName} ${lastName}`;
    hashTagText = `the${lastName.toLocaleLowerCase()}s`;
  }
  if (membersArr.length > 2) {
    membersArr.forEach((member, idx) => {
      [firstName, lastName] = member.name.split(' ');
      if (idx === membersArr.length - 1) {
        membersString += `and ${firstName} ${lastName}`;
        return;
      }
      membersString += firstName + ', ';
    });
    hashTagText = `the${lastName.toLocaleLowerCase()}s`;
  }
  return `Thank you ${membersString} for ${
    isRenewal ? 'renewing ' : ''
  }your GSRC membership!!!\n#belike${hashTagText} #${isRenewal ? 'renew' : 'join'}today`;
}
