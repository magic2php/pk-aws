(function () {
    const originalFetch = window.fetch;
    console.log('originalFetch', originalFetch);
    window.fetch = function (...args) {
      const [resource, config] = args;
      const isJobSearchPage = window.location.pathname === "/app" && window.location.hash.startsWith("#/jobSearch");
      if (isJobSearchPage && typeof resource === "string" && resource.includes("appsync-api.us-east-1.amazonaws.com/graphql")) {
        if (_q()) return;
        return originalFetch.apply(this, args).then(response => {
          const cloned = response.clone();
          //console.log('cloned', cloned);
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
  
        const candidateId = localStorage.getItem("idToken");
        console.log("📦 candidateId ID:", candidateId);
        if (!candidateId) {
          console.warn("⚠️ candidateId not found in localStorage.");
          return;
        }
  
        await redirectedToCreateApplicationPage(jobId, scheduleId, candidateId, accessToken);
        //await createCandidateApplication(jobId, scheduleId, candidateId, accessToken);
      } catch (error) {
        console.error("❌ Error in job application sequence:", error);
      }
    }
  
    async function fetchJobDetail(jobId, accessToken) {
      const locale = localStorage.getItem("i18nextLng")??'en-CA';    
      const detailHeaders = new Headers();
      detailHeaders.append("Authorization", accessToken);
      detailHeaders.append("Content-Type", "application/json");
      if (_q()) return;
      const jobDetailBody = JSON.stringify({
        operationName: "getJobDetail",
        variables: {
          getJobDetailRequest: {
            locale: locale,
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
      const locale = localStorage.getItem("i18nextLng")??'en-CA';    
      const scheduleHeaders = new Headers();
      scheduleHeaders.append("Authorization", accessToken);
      scheduleHeaders.append("Content-Type", "application/json");
      if (_q()) return;
      const today = new Date().toISOString().split("T")[0];
  
      const scheduleBody = JSON.stringify({
        operationName: "searchScheduleCards",
        variables: {
          searchScheduleRequest: {
            locale: locale,
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
  
  
    async function redirectedToCreateApplicationPage(jobId, scheduleId, candidateId, accessToken) {
      const locale = localStorage.getItem("i18nextLng")??'en-CA';    
      const countryCode = locale.split("-")[1].toLowerCase(); // "us"
      if(countryCode != 'us'){
        countryCode = 'ca'
      }
  
      const apiBase = window.location.origin;
  
      const iframeUrl = `${apiBase}/application/${countryCode}/?CS=true&jobId=${jobId}&locale=${locale}&query=warehouse&scheduleId=${scheduleId}&ssoEnabled=1#/pre-consent?CS=true&jobId=${jobId}&locale=${locale}&query=warehouse&scheduleId=${scheduleId}&ssoEnabled=1`;
      window.location.href = iframeUrl;
      return false;
     /*
      console.log("📦 Loading application page into iframe:", iframeUrl);
  
      // Remove existing iframe if any
      const oldIframe = document.getElementById("applicationFrame");
      if (oldIframe) oldIframe.remove();
  
      // Create new iframe
      const iframe = document.createElement("iframe");
      iframe.src = iframeUrl;
      iframe.id = "applicationFrame";
      iframe.style.width = "100%";
      iframe.style.height = "1000px";
      iframe.style.border = "1px solid #ccc";
      iframe.style.zIndex = "9999";
      iframe.style.position = "relative"; // or 'fixed' for overlay
      iframe.allow = "clipboard-write";
  
      document.body.prepend(iframe);
  
      // Wait for iframe to fully load
      iframe.onload = () => {
        console.log("✅ Iframe loaded successfully.");
        tryClickNextInIframe(iframe);
      };
      */
    }
    tryClickNextOnPage();
  
    function tryClickNextOnPage() {
      function performInteraction() {
        let actionTaken = false;
      
        // 1️⃣ Click "Next" or "Create Application" if not disabled
        const buttons = document.querySelectorAll("button");
        for (let btn of buttons) {
          const label = (btn.textContent || "").trim().toLowerCase();
          const isDisabled = btn.disabled || btn.getAttribute("aria-disabled") === "true";
      
          if ((label === "next" || label === "create application") && !isDisabled) {
            console.log(`➡️ Clicking '${label.charAt(0).toUpperCase() + label.slice(1)}'...`);
            btn.click();
            actionTaken = true;
            break;
          }
        }
      
        // 2️⃣ Try to select first non-Yes/No radio only if not already selected
        let radioSelected = false;
        const radios = document.querySelectorAll('input[type="radio"]');
        for (let radio of radios) {
          const label = radio.closest("label");
          const text = label?.textContent?.trim().toLowerCase();
      
          if (text !== "yes") {
            if (!radio.checked) {
              console.log("🔘 Selecting:", text);
              radio.click();
              actionTaken = true;
            }
            radioSelected = true;
            break;
          }
        }
      
        // 3️⃣ Click "Continue" only if not disabled and radio is selected
        if (radioSelected) {
          for (let btn of buttons) {
            const label = (btn.textContent || "").trim().toLowerCase();
            const isDisabled = btn.disabled || btn.getAttribute("aria-disabled") === "true";
      
            if (label === "continue" && !isDisabled) {
              console.log("➡️ Clicking 'Continue'...");
              btn.click();
              actionTaken = true;
              break;
            }
          }
        }
      
        return actionTaken;
      }
      
    
      // 🔄 Watch the live DOM
      const observer = new MutationObserver(() => {
        performInteraction(); // Do not stop on first match
      });
    
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    
      // Also run immediately (initial load)
      //setTimeout(() => {
        performInteraction();
      //}, 1000);
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