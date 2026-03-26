async function bookData() {
      const REST_API_KEY = '7b2300fc6315bb65035d1a3c7b49b161';

      const params = new URLSearchParams({
        target: "title",
        query: "킬 유어 달링"
      });

      const url = `https://dapi.kakao.com/v3/search/book?${params}`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `KakaoAK ${REST_API_KEY}` }
        });

        if (!response.ok) throw new Error(`HTTP 오류: ${response.status}`);

        const data = await response.json();
        const book = data?.documents?.[0];

        if (!book) {
          console.warn("검색 결과가 없습니다.");
          return;
        }

        const subBox = document.querySelector(".sub_box");
        const contextBox = document.querySelector(".contextbox");
        const priceNum = document.querySelector(".pricenum");

        const { title, thumbnail, authors, price, contents } = book;

        if (subBox) {
          subBox.innerHTML = `
        ${thumbnail ? `<img src="${thumbnail}" alt="${title ?? 'book'} 표지">` : ""}
      `;
        }

        if (priceNum) {
          const priceText = (typeof price === "number")
            ? `${price.toLocaleString()}원`
            : `${price ?? ""}원`;
          priceNum.textContent = priceText;
        }

        if (contextBox) {
          contextBox.innerHTML = `
        <h6>${authors?.[0] ?? ""}</h6>
        <p>${contents ?? ""}</p>
        <span>자세히보기</span>
      `;
        }

        const introEl = document.getElementById("introContent");
        if (introEl && introEl.textContent.includes("불러오는 중")) {
          introEl.textContent = contents ?? "";
        }

      } catch (error) {
        console.log('에러발생', error);
      }
    }

    function parseTxtSections(rawText) {
      // 제목 변형(띄어쓰기 유무)까지 대응
      const headingRegex = /(책\s*소개|목차|저자\s*소개)\s*[:：]?\s*\n+/g;

      const found = [];
      let match;

      while ((match = headingRegex.exec(rawText)) !== null) {
        const heading = match[1].replace(/\s/g, "");
        let key = "";
        if (heading === "책소개") key = "intro";
        else if (heading === "목차") key = "toc";
        else if (heading === "저자소개") key = "author";

        found.push({ key, start: headingRegex.lastIndex, at: match.index });
      }

      if (found.length === 0) {
        return { intro: rawText.trim(), toc: "", author: "" };
      }

      const result = { intro: "", toc: "", author: "" };

      for (let i = 0; i < found.length; i++) {
        const cur = found[i];
        const next = found[i + 1];
        const end = next ? next.at : rawText.length;
        const chunk = rawText.slice(cur.start, end).trim();
        result[cur.key] = chunk;
      }
      return result;
    }

    function textToHtml(text) {
      const escaped = text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      return escaped.replaceAll("\n", "<br>");
    }

    async function loadTxt1() {
      try {
        const response = await fetch("./sub_txt/txt1.txt");
        if (!response.ok) throw new Error("txt1.txt 로드 실패");

        const raw = await response.text();
        const sections = parseTxtSections(raw);

        const introEl = document.getElementById("introContent");
        const tocEl = document.getElementById("tocContent");
        const authorEl = document.getElementById("authorContent");

        if (introEl) introEl.innerHTML = sections.intro ? textToHtml(sections.intro) : "내용이 없습니다.";
        if (tocEl) tocEl.innerHTML = sections.toc ? textToHtml(sections.toc) : "내용이 없습니다.";
        if (authorEl) authorEl.innerHTML = sections.author ? textToHtml(sections.author) : "내용이 없습니다.";

      } catch (error) {
        console.error("txt1 로딩 에러:", error);

        ["introContent", "tocContent", "authorContent"].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = "내용을 불러오지 못했습니다. (로컬에서는 서버 실행 필요)";
        });
      }
    }

    function setupTabs() {
      const tabButtons = document.querySelectorAll(".tab-btn");

      tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
          // active 처리
          tabButtons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");

          // 스크롤 이동
          const targetSelector = btn.getAttribute("data-target");
          const targetEl = document.querySelector(targetSelector);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });

      // (선택) 스크롤로 내려가도 현재 섹션에 맞춰 탭 active 바꾸고 싶으면 IntersectionObserver 추가 가능
    }

    function textToHtml(text) {
      const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');

      if (lines.length === 0) return '';

      const title = lines[0];       // 첫 줄: 제목
      const items = lines.slice(1); // 나머지: 항목들


      return `
    <div class="guide-body">
      <div class="guide-title"><strong>${escapeHtml(title)}</strong></div>
      ${items.length ? `<ul class="guide-list">${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}
    </div>
  `;
    }

    function escapeHtml(str) {
      return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }



    async function loadTxt2() {
      try {
        const response = await fetch("./sub_txt/txt2.txt");
        if (!response.ok) throw new Error("txt2.txt 로드 실패");

        const raw = await response.text();

        const el = document.getElementById("ebookGuideContent");
        if (el) el.innerHTML = textToHtml(raw);

      } catch (e) {
        const el = document.getElementById("ebookGuideContent");
        if (el) el.textContent = "내용을 불러오지 못했습니다. (로컬에서는 서버 실행 필요)";
      }
    }

    document.addEventListener("DOMContentLoaded", async () => {
      setupTabs();
      await loadTxt1();
      await loadTxt2();
      await bookData();
    });

    const tabs = document.querySelectorAll('.tab-btn1');

    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });