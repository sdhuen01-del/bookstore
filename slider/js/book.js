async function bookData() {
            const params = new URLSearchParams({
                target: "title",
                query: "미움받을 용기",
                size: 10
            });

            const url = `https://dapi.kakao.com/v3/search/book?${params}`;

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        Authorization: "KakaoAK 7b2300fc6315bb65035d1a3c7b49b161"
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
                }

                const data = await response.json();
                console.log(data);

                // .box 요소 전체 선택
                const boxElements = document.querySelectorAll("#new .swiper-slide");

                // documents 데이터를 각 box에 대응하여 렌더링
                boxElements.forEach((box, i) => {
                    const doc = data.documents[i];

                    if (!doc) return; // 데이터가 부족할 경우 생략

                    // 요소 생성 및 추가
                    box.innerHTML = `<img src="${data.documents[i].thumbnail}">
                    <h3>${data.documents[i].title}</h3>
                    <h6>${data.documents[i].authors}</h6>
                    <p>${data.documents[i].contents.substring(0, 60)}</p>
                    <button>click</button>
                    `
                });

            } catch (error) {
                console.log('에러발생', error);
            }
        }

        bookData();