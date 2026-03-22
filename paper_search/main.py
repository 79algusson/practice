import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
import threading
import os
import sys
import datetime
import anthropic

from pdf_generator import generate_pdf
from excel_generator import generate_excel

SYSTEM_PROMPT = """당신은 과학교육 분야 논문 검색 및 정리를 도와주는 학술 연구 어시스턴트입니다.

# 핵심 임무
사용자가 키워드를 제시하면 다음 4단계를 순서대로 수행합니다.

## 1단계: 논문 검색
- 키워드와 관련된 최근 3년(2022~2025) 논문을 5편 찾습니다.
- 과학교육(Science Education) 분야 우선, 필요 시 STEM·교육학 일반 포함
- 영어 논문 위주, 요청 시 한국 KCI 등재 논문 포함
- 반드시 실제 존재하는 논문만 제시합니다. 불확실한 논문은 제외합니다.

## 2단계: Google Scholar 검증
- 각 논문의 Google Scholar 검색 URL을 생성합니다.
  형식: https://scholar.google.com/scholar?q=[논문제목]
- 제목, 저자, 연도, 학술지가 일치하는지 확인 여부를 명시합니다.
- 확실한 논문: ✅ 표시
- 불확실한 논문: ⚠️ 표시 후 "수동 확인 필요" 명시

## 3단계: 논문 내용 요약
각 논문을 200단어 내외로 한국어 요약합니다.
요약에는 반드시 다음 4가지를 포함합니다:
- 연구 목적
- 연구 방법
- 주요 결과
- 교육적 시사점

## 4단계: APA 7th 인용 정리
- APA 7th 스타일로 완전한 인용을 작성합니다.
- DOI는 반드시 https://doi.org/10.xxxx 형태로 포함합니다.
- DOI가 없는 경우 명시합니다.

# 출력 형식
각 논문을 아래 구조로 출력합니다:

---
**[번호] 논문 제목** [✅ or ⚠️]
- 저자 / 연도 / 학술지
- Google Scholar 확인: [URL]

**요약**
(200단어 내외 한국어 요약)

**APA 인용**
(완전한 APA 7th 인용 + DOI)
---

# 주의사항
- 논문을 지어내지 않습니다. 확실하지 않으면 편수를 줄이더라도 정확한 논문만 제시합니다.
- 모든 요약과 설명은 한국어로 작성합니다.
"""


class PaperSearchApp:
    def __init__(self, root):
        self.root = root
        self.root.title("과학교육 논문 검색 어시스턴트")
        self.root.geometry("900x750")
        self.root.configure(bg="#f0f4f8")

        self.current_result = ""
        self.current_keyword = ""
        self.search_date = ""
        self._build_ui()

    def _build_ui(self):
        # Header
        header = tk.Frame(self.root, bg="#2c5f8a", pady=12)
        header.pack(fill="x")
        tk.Label(
            header,
            text="📚 과학교육 논문 검색 어시스턴트",
            font=("맑은 고딕", 16, "bold"),
            bg="#2c5f8a",
            fg="white",
        ).pack()

        # API Key frame
        api_frame = tk.Frame(self.root, bg="#f0f4f8", pady=6)
        api_frame.pack(fill="x", padx=20)
        tk.Label(api_frame, text="Anthropic API Key:", bg="#f0f4f8", font=("맑은 고딕", 10)).pack(side="left")
        self.api_key_var = tk.StringVar()
        env_key = os.environ.get("ANTHROPIC_API_KEY", "")
        self.api_key_var.set(env_key)
        api_entry = tk.Entry(api_frame, textvariable=self.api_key_var, width=55, show="*", font=("맑은 고딕", 10))
        api_entry.pack(side="left", padx=6)

        # Search frame
        search_frame = tk.Frame(self.root, bg="#f0f4f8", pady=6)
        search_frame.pack(fill="x", padx=20)
        tk.Label(search_frame, text="검색 키워드:", bg="#f0f4f8", font=("맑은 고딕", 11, "bold")).pack(side="left")
        self.keyword_var = tk.StringVar()
        keyword_entry = tk.Entry(search_frame, textvariable=self.keyword_var, width=45, font=("맑은 고딕", 11))
        keyword_entry.pack(side="left", padx=8)
        keyword_entry.bind("<Return>", lambda e: self._start_search())

        self.search_btn = tk.Button(
            search_frame,
            text="논문 검색",
            command=self._start_search,
            bg="#2c5f8a",
            fg="white",
            font=("맑은 고딕", 11, "bold"),
            padx=14,
            pady=4,
            relief="flat",
            cursor="hand2",
        )
        self.search_btn.pack(side="left", padx=4)

        # Options
        opt_frame = tk.Frame(self.root, bg="#f0f4f8")
        opt_frame.pack(fill="x", padx=20, pady=2)
        self.include_kci = tk.BooleanVar(value=False)
        tk.Checkbutton(opt_frame, text="KCI 한국 논문 포함", variable=self.include_kci, bg="#f0f4f8", font=("맑은 고딕", 10)).pack(side="left")
        tk.Label(opt_frame, text="  검색 편수:", bg="#f0f4f8", font=("맑은 고딕", 10)).pack(side="left")
        self.num_papers = ttk.Combobox(opt_frame, values=["3", "5", "7", "10"], width=4, state="readonly")
        self.num_papers.set("5")
        self.num_papers.pack(side="left", padx=4)

        # Status bar
        self.status_var = tk.StringVar(value="키워드를 입력하고 검색을 시작하세요.")
        status_bar = tk.Label(self.root, textvariable=self.status_var, bg="#dce8f5", anchor="w", padx=10, font=("맑은 고딕", 9))
        status_bar.pack(fill="x", padx=20, pady=(4, 0))

        # Progress bar
        self.progress = ttk.Progressbar(self.root, mode="indeterminate")
        self.progress.pack(fill="x", padx=20, pady=2)

        # Result area
        result_frame = tk.Frame(self.root, bg="#f0f4f8")
        result_frame.pack(fill="both", expand=True, padx=20, pady=6)
        tk.Label(result_frame, text="검색 결과:", bg="#f0f4f8", font=("맑은 고딕", 10, "bold"), anchor="w").pack(fill="x")
        self.result_text = scrolledtext.ScrolledText(
            result_frame,
            font=("맑은 고딕", 10),
            wrap=tk.WORD,
            state="disabled",
            bg="white",
            relief="sunken",
            padx=8,
            pady=8,
        )
        self.result_text.pack(fill="both", expand=True)

        # Save buttons
        save_frame = tk.Frame(self.root, bg="#f0f4f8", pady=8)
        save_frame.pack(fill="x", padx=20)
        self.pdf_btn = tk.Button(
            save_frame, text="📄 PDF로 저장", command=lambda: self._save_file("pdf"),
            state="disabled", bg="#e67e22", fg="white", font=("맑은 고딕", 10, "bold"),
            padx=12, pady=4, relief="flat", cursor="hand2",
        )
        self.pdf_btn.pack(side="left", padx=4)
        self.excel_btn = tk.Button(
            save_frame, text="📊 엑셀로 저장", command=lambda: self._save_file("excel"),
            state="disabled", bg="#27ae60", fg="white", font=("맑은 고딕", 10, "bold"),
            padx=12, pady=4, relief="flat", cursor="hand2",
        )
        self.excel_btn.pack(side="left", padx=4)
        self.both_btn = tk.Button(
            save_frame, text="💾 둘 다 저장", command=lambda: self._save_file("both"),
            state="disabled", bg="#8e44ad", fg="white", font=("맑은 고딕", 10, "bold"),
            padx=12, pady=4, relief="flat", cursor="hand2",
        )
        self.both_btn.pack(side="left", padx=4)

    def _start_search(self):
        keyword = self.keyword_var.get().strip()
        api_key = self.api_key_var.get().strip()
        if not keyword:
            messagebox.showwarning("입력 오류", "검색 키워드를 입력해주세요.")
            return
        if not api_key:
            messagebox.showwarning("API Key 없음", "Anthropic API Key를 입력해주세요.")
            return

        self.current_keyword = keyword
        self.search_date = datetime.datetime.now().strftime("%Y%m%d")
        self._set_result_text("검색 중입니다. 잠시 기다려주세요...\n")
        self._set_buttons(False)
        self.search_btn.config(state="disabled")
        self.progress.start(10)
        self.status_var.set(f"'{keyword}' 논문 검색 중...")

        thread = threading.Thread(target=self._do_search, args=(keyword, api_key), daemon=True)
        thread.start()

    def _do_search(self, keyword, api_key):
        try:
            client = anthropic.Anthropic(api_key=api_key)
            num = self.num_papers.get()
            kci_text = "KCI 한국 논문도 포함해주세요." if self.include_kci.get() else ""
            user_msg = f"키워드: {keyword}\n검색 편수: {num}편\n{kci_text}"

            full_response = ""
            with client.messages.stream(
                model="claude-opus-4-6",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            ) as stream:
                for text in stream.text_stream:
                    full_response += text
                    self.root.after(0, self._append_result_text, text)

            self.current_result = full_response
            self.root.after(0, self._on_search_done)
        except anthropic.AuthenticationError:
            self.root.after(0, self._on_error, "API Key가 올바르지 않습니다. 다시 확인해주세요.")
        except Exception as e:
            self.root.after(0, self._on_error, f"오류 발생: {str(e)}")

    def _append_result_text(self, text):
        self.result_text.config(state="normal")
        self.result_text.insert(tk.END, text)
        self.result_text.see(tk.END)
        self.result_text.config(state="disabled")

    def _set_result_text(self, text):
        self.result_text.config(state="normal")
        self.result_text.delete("1.0", tk.END)
        self.result_text.insert(tk.END, text)
        self.result_text.config(state="disabled")

    def _on_search_done(self):
        self.progress.stop()
        self.search_btn.config(state="normal")
        self._set_buttons(True)
        self.status_var.set(f"'{self.current_keyword}' 검색 완료. 파일로 저장할 수 있습니다.")

    def _on_error(self, msg):
        self.progress.stop()
        self.search_btn.config(state="normal")
        self.status_var.set("오류가 발생했습니다.")
        messagebox.showerror("오류", msg)

    def _set_buttons(self, enabled):
        state = "normal" if enabled else "disabled"
        self.pdf_btn.config(state=state)
        self.excel_btn.config(state=state)
        self.both_btn.config(state=state)

    def _save_file(self, file_type):
        if not self.current_result:
            messagebox.showwarning("저장 오류", "먼저 논문 검색을 수행해주세요.")
            return

        safe_keyword = self.current_keyword.replace(" ", "_")
        default_name = f"논문검색_{safe_keyword}_{self.search_date}"
        save_dir = filedialog.askdirectory(title="저장할 폴더를 선택하세요")
        if not save_dir:
            return

        saved = []
        try:
            if file_type in ("pdf", "both"):
                pdf_path = os.path.join(save_dir, f"{default_name}.pdf")
                generate_pdf(pdf_path, self.current_keyword, self.search_date, self.current_result)
                saved.append(pdf_path)
            if file_type in ("excel", "both"):
                xlsx_path = os.path.join(save_dir, f"{default_name}.xlsx")
                generate_excel(xlsx_path, self.current_keyword, self.search_date, self.current_result)
                saved.append(xlsx_path)

            msg = "파일이 저장되었습니다:\n" + "\n".join(saved)
            messagebox.showinfo("저장 완료", msg)
            self.status_var.set("파일 저장 완료: " + ", ".join(os.path.basename(p) for p in saved))
        except Exception as e:
            messagebox.showerror("저장 오류", f"파일 저장 중 오류가 발생했습니다:\n{e}")


def main():
    root = tk.Tk()
    app = PaperSearchApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
