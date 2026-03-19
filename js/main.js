sync function fetchBooks(query) {
            const params = new URLSearchParams({
                target: "title",
                query,
                size: 50
            });
            const url = `https://dapi.kakao.com/v3/search/book?${params}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: "KakaoAK 7b2300fc6315bb65035d1a3c7b49b161"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP 오류: ${response.status}`);
            }

            return response.json();
        }

        async function bookData() {
            try {
                const queries = [
                    { query: "박경리", sectionId: "author1" },
                    { query: "기욤뮈소", sectionId: "author2" },
                    { query: "박완서", sectionId: "author3" },
                ];

                for (const { query, sectionId } of queries) {
                    const data = await fetchBooks(query);

                    //썸네일이 빈 문자열인것은 제외
                    const origin = data.documents;
                    let book = origin.filter((val)=>{
                        return val.thumbnail != '' && val.contents !='';
                    })

                    const section = document.querySelector(`#${sectionId}`);

                    // 제목 <h3> 추가
                    const title = document.createElement('h3');
                    title.textContent = query;
                    section.appendChild(title);

                    // 8개 div 생성 및 내용 삽입
                    for (let j = 0; j < 8; j++) {
                        const doc = book[j];
                        if (!doc) continue;

                        const div = document.createElement('div');
                        div.className = 'box';

                        // 요소 생성 및 추가
                        div.innerHTML = `<img src="${doc.thumbnail}">
                        <h3>${doc.title}</h3>
                        <h6>${doc.authors}</h6>
                        <p>${doc.contents.substring(0, 60)}</p>
                        <button>click</button>
                        `

                        // section에 div 추가
                        section.appendChild(div);
                    }
                }
            } catch (error) {
                console.log('에러발생', error);
            }
        }

        bookData();