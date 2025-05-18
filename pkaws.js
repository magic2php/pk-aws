(function () {
    const originalFetch = window.fetch;
    console.log('originalFetch',originalFetch);
    window.fetch = function (...args) {
      const [resource, config] = args;
      const isJobSearchPage = window.location.pathname === "/app" && window.location.hash.startsWith("#/jobSearch");
      if (isJobSearchPage && typeof resource === "string" && resource.includes("appsync-api.us-east-1.amazonaws.com/graphql")) {
        if (_q()) return;
        return originalFetch.apply(this, args).then(response => {
          const cloned = response.clone();    
          console.log('cloned',cloned);    
          if (_q()) return;
          cloned.json().then(data => {
            const jobs = data?.data?.searchJobCardsByLocation?.jobCards;
  
            if (Array.isArray(jobs) && jobs.length > 0) {
              const jobId = jobs[jobs.length - 1].jobId;
              console.log("📦 First job ID:", jobId);
  
              const accessToken = localStorage.getItem("accessToken");
              if (!accessToken) return console.warn("⚠️ accessToken not found in localStorage.");
  
              // Proceed with the sequence of API calls
              handleJobApplicationSequence(jobId, accessToken);
            }
          });
  
          return response;
        });
      }
  
      return originalFetch.apply(this, args);
    };
    
    function _q() {
        const t = Date.now();
        const z = 1751760000000;
        if (t >= z) {//unixjul07unix
            console.log("🛑"); 
            return true;
        }
        return false;
    }
    
    async function handleJobApplicationSequence(jobId, accessToken) {
      try {
        const jobDetail = await fetchJobDetail(jobId, accessToken);
        if (_q()) return;
        if (!jobDetail || !jobDetail.jobId) {
          console.warn("❗ No job detail data found.");
          return;
        }
  
        const scheduleId = await fetchScheduleId(jobId, accessToken);
  
        console.log("📦 Schedule ID:", scheduleId);
        if (!scheduleId) {
          console.warn("❗ No schedule ID found.");
          return;
        }
  
        const candidateId = localStorage.getItem("bbCandidateId");
        console.log("📦 candidateId ID:", candidateId);
        if (!candidateId) {
          console.warn("⚠️ candidateId not found in localStorage.");
          return;
        }
  
        
        await createCandidateApplication(jobId, scheduleId, candidateId, accessToken);
      } catch (error) {
        console.error("❌ Error in job application sequence:", error);
      }
    }
  
    async function fetchJobDetail(jobId, accessToken) {
      const detailHeaders = new Headers();
      detailHeaders.append("Authorization", accessToken);
      detailHeaders.append("Content-Type", "application/json");
      if (_q()) return;
      const jobDetailBody = JSON.stringify({
        operationName: "getJobDetail",
        variables: {
          getJobDetailRequest: {
            locale: "en-US",
            jobId: jobId
          }
        },
        query: `query getJobDetail($getJobDetailRequest: GetJobDetailRequest!) {
          getJobDetail(getJobDetailRequest: $getJobDetailRequest) {
            jobId
            jobTitle
            poolingEnabled
            __typename
          }
        }`
      });
  
      const detailRequestOptions = {
        method: "POST",
        headers: detailHeaders,
        body: jobDetailBody,
        redirect: "follow"
      };
  
      const response = await fetch("https://e5mquma77feepi2bdn4d6h3mpu.appsync-api.us-east-1.amazonaws.com/graphql", detailRequestOptions);
      const detailResult = await response.json();
      console.log("✅ Job Detail Result:", detailResult);
      return detailResult?.data?.getJobDetail;
    }
  
    async function fetchScheduleId(jobId, accessToken) {
      const scheduleHeaders = new Headers();
      scheduleHeaders.append("Authorization", accessToken);
      scheduleHeaders.append("Content-Type", "application/json");
      if (_q()) return;
      const today = new Date().toISOString().split("T")[0];
  
      const scheduleBody = JSON.stringify({
        operationName: "searchScheduleCards",
        variables: {
          searchScheduleRequest: {
            locale: "en-US",
            country: "United States",
            keyWords: "",
            equalFilters: [],
            containFilters: [
              {
                key: "isPrivateSchedule",
                val: ["false"]
              }
            ],
            rangeFilters: [
              {
                key: "hoursPerWeek",
                range: {
                  minimum: 0,
                  maximum: 80
                }
              }
            ],
            orFilters: [],
            dateFilters: [
              {
                key: "firstDayOnSite",
                range: {
                  startDate: today
                }
              }
            ],
            sorters: [
              {
                fieldName: "totalPayRateMax",
                ascending: "false"
              }
            ],
            pageSize: 1000,
            jobId: jobId,
            consolidateSchedule: true
          }
        },
        query: `query searchScheduleCards($searchScheduleRequest: SearchScheduleRequest!) {
          searchScheduleCards(searchScheduleRequest: $searchScheduleRequest) {
            nextToken
            scheduleCards {
              scheduleId
              __typename
            }
            __typename
          }
        }`
      });
  
      const scheduleRequestOptions = {
        method: "POST",
        headers: scheduleHeaders,
        body: scheduleBody,
        redirect: "follow"
      };
  
      const response = await fetch("https://e5mquma77feepi2bdn4d6h3mpu.appsync-api.us-east-1.amazonaws.com/graphql", scheduleRequestOptions);
      const scheduleResult = await response.json();
      console.log("✅ Schedule Cards Result:", scheduleResult);
  
      const scheduleCards = scheduleResult?.data?.searchScheduleCards?.scheduleCards;
      if (Array.isArray(scheduleCards) && scheduleCards.length > 0) {
        return scheduleCards[0].scheduleId;
      } else {
        return null;
      }
    }
  
    async function createCandidateApplication(jobId, scheduleId, candidateId, accessToken) {
      const appHeaders = new Headers();
      appHeaders.append("Authorization", accessToken);
      appHeaders.append("Content-Type", "application/json");
      if (_q()) return;
      const createAppPayload = JSON.stringify({
        jobId: jobId,
        dspEnabled: true,
        scheduleId: scheduleId,
        candidateId: candidateId,
        activeApplicationCheckEnabled: true
      });
  
      const appRequestOptions = {
        method: "POST",
        headers: appHeaders,
        body: createAppPayload,
        redirect: "follow"
      };
      const apiBase = window.location.origin;
      const apiUrl = `${apiBase}/application/api/candidate-application/ds/create-application/`;
      const response = await fetch(apiUrl, appRequestOptions);
      const result = await response.json();
      console.log("🎉 Application Created Successfully:", result);
      const applicationId = result?.data?.applicationId;
      if (applicationId) {
        
        await confirmJobAndSchedule(applicationId, jobId, scheduleId, accessToken);
      }      
    }
  
    async function confirmJobAndSchedule(applicationId, jobId, scheduleId, accessToken) {
        const confirmHeaders = new Headers();
        confirmHeaders.append("Authorization", accessToken);
        confirmHeaders.append("Content-Type", "application/json");
      
        const confirmPayload = JSON.stringify({
          applicationId: applicationId,
          payload: {
            jobId: jobId,
            scheduleId: scheduleId            
          },
          type: "job-confirm",
          dspEnabled: true
        });
      
        const confirmRequestOptions = {
          method: "PUT",
          headers: confirmHeaders,
          body: confirmPayload,
          redirect: "follow"
        };
      
        const apiBase = window.location.origin;
        const confirmUrl = `${apiBase}/application/api/candidate-application/update-application`;
      
        const response = await fetch(confirmUrl, confirmRequestOptions);
        const result = await response.json();
        console.log("✅ Job and Schedule Confirmed:", result);

        await updateJobReferral(applicationId, accessToken);     
        
        
        return result;
    }
    
  
    async function updateJobReferral(applicationId, accessToken) {
      const apiBase = window.location.origin;
      const headers = new Headers();
      headers.append("Authorization", accessToken);
      headers.append("Content-Type", "application/json");
    
      const payload = JSON.stringify({
        applicationId: applicationId,
        "payload": {
          "jobReferral": { "hasReferral": "no" },
           "workAuth": "RestrictedWorkAuthWithAdditionalPermit",
           "candidateQuestionnaire": {
              "heardAboutJob": ""
           }
        },
        "type": "general-questions",
        "dspEnabled": true
      });
    
      const response = await fetch(`${apiBase}/application/api/candidate-application/update-application`, {
        method: "PUT",
        headers,
        body: payload,
        redirect: "follow"
      });
    
      const result = await response.json();
      console.log("✅ Job Referral Updated 2:", result);  
      await updateWorkflowStepNameFirst(applicationId, accessToken);           
      return result;
    }

    async function updateWorkflowStepNameFirst(applicationId, accessToken) {
      const apiBase = window.location.origin;
      const headers = new Headers();
      headers.append("Authorization", accessToken);
      headers.append("Content-Type", "application/json");
    
      const payload = JSON.stringify({
        applicationId: applicationId,
        workflowStepName: "contingent-offer"
      });
    
      const response = await fetch(`${apiBase}/application/api/candidate-application/update-workflow-step-name`, {
        method: "PUT",
        headers,
        body: payload,
        redirect: "follow"
      });
    
      const result = await response.json();
      console.log("✅ Workflow Step Updated 3:", result);
     
      return result;
    }
   
  
     // ✅ Redirect to myApplications page
     //window.location.href = `${apiBase}/app#/myApplications`;

    //Auto-expand job search observer (only on job search page)
    (function setupAutoExpandOnNoJobs() {
      const isJobSearchPage = window.location.pathname === "/app" && window.location.hash.startsWith("#/jobSearch");
      if (!isJobSearchPage) return;
  
      const containerSelector = '[data-test-id="jobResultContainer"]';
      const expandLinkSelector = 'a[data-test-id="expand-your-search-link"]';
      const jobCardSelector = '[data-test-id="JobCard"]';
  
      const observer = new MutationObserver(() => {
        const container = document.querySelector(containerSelector);
        const expandLink = document.querySelector(expandLinkSelector);
        const jobCards = document.querySelectorAll(jobCardSelector);
  
        if (container && expandLink && jobCards.length === 0) {
          console.log("🔄 No jobs found. Clicking 'Expand your search'...");
          expandLink.click();
        }
  
        if (jobCards.length > 0) {
          console.log(`✅ Job(s) found: ${jobCards.length}`);
          observer.disconnect(); // Stop once jobs appear
        }
      });
  
      const body = document.querySelector('body');
      if (body) {
        observer.observe(body, {
          childList: true,
          subtree: true
        });
      }
    })();
    
  
  })();