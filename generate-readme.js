const { Octokit } = require("@octokit/rest");
const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const moment = require("moment");

Handlebars.registerHelper('humanize', function(date) {
  return moment(date).fromNow();
});

async function getData() {
  const token = process.env.GITHUB_TOKEN;
  const username = process.env.USERNAME || 'reoden';
  const octokit = new Octokit({ auth: token });

  // Get user events
  const events = await octokit.activity.listEventsForAuthenticatedUser({ per_page: 100 });
  const eventData = events.data;

  // Recent contributions (push events)
  const contributions = eventData.filter(e => e.type === 'PushEvent').slice(0, 3).map(e => ({
    Repo: { Name: e.repo.name, URL: `https://github.com/${e.repo.name}`, Description: '' },
    OccurredAt: e.created_at
  }));

  // Followers
  const followers = await octokit.users.listFollowersForUser({ username, per_page: 10 });
  const followersData = followers.data.map(f => ({ Login: f.login, URL: f.html_url }));

  // Recent stars (watch events)
  const stars = eventData.filter(e => e.type === 'WatchEvent').slice(0, 5).map(e => ({
    Repo: { Name: e.repo.name, URL: `https://github.com/${e.repo.name}`, Description: '' },
    StarredAt: e.created_at
  }));

  // Recent pull requests
  const prs = await octokit.search.issuesAndPullRequests({ q: `author:${username} type:pr`, per_page: 5, sort: 'created', order: 'desc' });
  const prsData = prs.data.items.map(p => ({
    Title: p.title,
    URL: p.html_url,
    Repo: { Name: p.repository_url.split('/').slice(-2).join('/'), URL: p.repository_url },
    CreatedAt: p.created_at
  }));

  return { recentContributions: contributions, followers: followersData, recentStars: stars, recentPullRequests: prsData };
}

async function main() {
  try {
    const data = await getData();
    const templatePath = path.join(__dirname, 'templates', 'README.md.tpl');
    const template = fs.readFileSync(templatePath, 'utf8');
    const compiled = Handlebars.compile(template);
    const result = compiled(data);
    fs.writeFileSync('README.md', result);
    console.log('README.md generated successfully');
  } catch (error) {
    console.error('Error generating README:', error);
    process.exit(1);
  }
}

main();