const { graphql } = require('@octokit/graphql');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
      // Input all the parameter 
        rl.question('Enter your GitHub Personal Access Token: ', (accessToken) => {
        rl.question('Enable strict mode (true/false): ', (strictModeInput) => {
          const strictMode = strictModeInput.trim().toLowerCase() === 'true';

          rl.question('Enter keywords (comma-separated): ', (keywordsInput) => {
            const keywords = keywordsInput.split(',').map(keyword => keyword.trim());

            rl.question('Enter exclude keywords (comma-separated): ', (excludeKeywordsInput) => {
              const excludeKeywordsList = excludeKeywordsInput.split(',').map(keyword => keyword.trim());

              rl.question('Enter readme keyword: ', (readmeKeyword) => {
                rl.question('Enter JSON file name with extension(.json): ', (jsonFileName) => {
              

// Define the GraphQL query to retrieve repository information
const query = `
  query SearchRepositories($searchQuery: String!, $afterCursor: String) {
    search(query: $searchQuery, type: REPOSITORY, first: 100, after: $afterCursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          ... on Repository {
            name
            primaryLanguage {
              name
            }
            owner {
              login
            }
            url
            description
          }
        }
      }
    }
  }
`;

// Defining the search query
const searchQuery = `${keywords.join(' OR ')}`;
console.log("searching For ",searchQuery.toLowerCase());
console.log("excluded keywords ",excludeKeywordsList);

// Initialize an array to store the repository information
const repositoriesInfo = [];

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${accessToken}`,
  },
});

// Function to fetch results up to the end
async function fetchRepositoriesUpToEnd(afterCursor = null) {
  const response = await graphqlWithAuth(query, { searchQuery, afterCursor });

  const repositories = response.search.edges;

  // Process and store the information for each repository
  for (const repo of repositories) {
    const name = repo.node.name;
    const language = repo.node.primaryLanguage ? repo.node.primaryLanguage.name : 'N/A';
    const author = repo.node.owner.login;
    const htmlUrl = repo.node.url;
    const description = repo.node.description || 'N/A';

    // Exclude repositories with names and descriptions containing excludeKeywordsList
    const excludeKeywords=excludeKeywordsList.some((e)=>
    {
       return name.toLowerCase().includes(e.toLowerCase()) && description.toLowerCase().includes(e.toLowerCase());
    })
    if (!excludeKeywords) {
      // Check if the repository contains any of the keywords only if stickMode is true
      let containsKeyword=true;
      if(strictMode){
      containsKeyword = keywords.some((keyword) => {
        return name.toLowerCase().includes(keyword.toLowerCase()) || description.toLowerCase().includes(keyword.toLowerCase());
      });
    }
    else{
      containsKeyword = true;
    }

      // If the repository contains a keyword, add it to the list
      if (containsKeyword) {
        // Fetch the README content for the repository
        const readmeContent = await fetchReadmeContent(author, name);
        const readmeLinks=[];
        // check for dataset keyword in README
        if (readmeContent.toLowerCase().includes(readmeKeyword.toLowerCase())){
          console.log("Keyword ",readmeKeyword," true " ,name);
          readmeLinks.push(readmeContent.match(/(https?|ftp):\/\/[^\s/$.?#].[^\s]*/gi));
        }
        else
        {
          console.log("Keyword ",readmeKeyword," false " , name);
        }
        // Count language use in Repos
        if (language !== 'N/A') {
          if (languageCount[language]) {
            languageCount[language]++;
          } else {
            languageCount[language] = 1;
          }
        }

        // Added repository details and README links to the array
        repositoriesInfo.push({
          name,
          language,
          author,
          htmlUrl,
          description,
          readmeLinks,
        });
    
        
      }
    }
  }

  // Checking if there are more pages of results,then continue fetching
  console.log("Next Page ",response.search.pageInfo.hasNextPage);
  if (response.search.pageInfo.hasNextPage) {
    await fetchRepositoriesUpToEnd(response.search.pageInfo.endCursor);
  } else {
    // All pages have been processed
    // Create an object with language
    const counts = {
      languageCount,
    };
    // Create a combined object with repositoriesInfo and counts
    const combinedData = {
      counts,
      repositoriesInfo,
    };

    // Save the combined data as a single JSON file
    fs.writeFileSync(jsonFileName, JSON.stringify(combinedData, null, 2), 'utf-8');
  }
}

// Function to fetch the README content for a repository
async function fetchReadmeContent(repoOwner, repoName) {
  const readmeQuery = `
    query GetReadmeContent($repoOwner: String!, $repoName: String!) {
      repository(owner: $repoOwner, name: $repoName) {
        object(expression: "main:README.md") {
          ... on Blob {
            text
          }
        }
      }
    }
  `;

  const response = await graphqlWithAuth(readmeQuery, {
    repoOwner,
    repoName,
  });
// Return an empty string if README is not found in the repos
  if (response.repository && response.repository.object && response.repository.object.text) {
    return response.repository.object.text;
  } else {
    return '';
  }


}

// Initialize counters for languages and datasets
const languageCount = {};

// Start fetching repositories from index 0 up to the end
fetchRepositoriesUpToEnd();
rl.close();
});
});
});
});
});
});
