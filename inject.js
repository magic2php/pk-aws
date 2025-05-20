(function () {
  var cdnScript = document.createElement("script");
  cdnScript.src = "https://cdn.jsdelivr.net/gh/magic2php/pk-aws@main/pkaws.js?r="+Math.random();
  cdnScript.onload = () => console.log("✅ CDN script loaded!");
  cdnScript.onerror = () => console.error("❌ Failed to load CDN script.");
  document.head.appendChild(cdnScript);
})();