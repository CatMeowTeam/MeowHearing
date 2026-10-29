; Meow Hearing — tuỳ biến trình cài / trình gỡ theo phong cách Meow (CatMeow Team)
!include MUI2.nsh
!include nsDialogs.nsh

; ---------- Mặc định cài vào ổ D: nếu máy có ổ D ----------
!macro preInit
  SetRegView 64
  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  StrCmp $0 "" 0 mh_done
  IfFileExists "D:\*.*" 0 mh_done
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\Meow Hearing"
  mh_done:
  SetRegView 32
  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  StrCmp $0 "" 0 mh_done32
  IfFileExists "D:\*.*" 0 mh_done32
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\Meow Hearing"
  mh_done32:
!macroend

; ---------- Trang chào khi cài ----------
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Chào mừng tới Meow Hearing"
  !define MUI_WELCOMEPAGE_TEXT "Nghe nhạc YouTube trên Windows theo kiểu Spotify: tìm bài, tạo playlist, lời bài hát chạy theo nhạc, mini player luôn nổi.$\r$\n$\r$\nBấm Tiếp để chọn nơi cài đặt (mặc định ổ D nếu máy có).$\r$\n$\r$\nPhát triển bởi CatMeow Team"
  !insertmacro MUI_PAGE_WELCOME
!macroend

; ---------- Trình gỡ: trang tạm biệt + chọn giữ/xoá dữ liệu ----------
!ifdef BUILD_UNINSTALLER
  Var MeowDelData
  Var MeowChk

  !macro customUnWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "Tạm biệt Meow Hearing?"
    !define MUI_WELCOMEPAGE_TEXT "Mèo sẽ nhớ bạn lắm đó!$\r$\n$\r$\nTrình gỡ sẽ xoá Meow Hearing khỏi máy này. Ở bước tiếp theo bạn chọn giữ lại hay xoá playlist, bài đã thích và lịch sử nghe.$\r$\n$\r$\nCảm ơn bạn đã nghe nhạc cùng mèo.$\r$\nCatMeow Team"
    !insertmacro MUI_UNPAGE_WELCOME
    UninstPage custom un.MeowDataPage un.MeowDataLeave
  !macroend

  Function un.MeowDataPage
    StrCpy $MeowDelData ${BST_UNCHECKED}
    !insertmacro MUI_HEADER_TEXT "Dữ liệu của bạn" "Giữ lại để lần sau cài lại vẫn còn nguyên playlist."
    nsDialogs::Create 1018
    Pop $0
    ${NSD_CreateLabel} 0 0 100% 30u "Playlist, bài đã thích, lịch sử nghe, tài khoản YouTube đã đăng nhập và cài đặt đang được lưu trên máy này. Mặc định Meow Hearing giữ lại chúng."
    Pop $0
    ${NSD_CreateCheckbox} 0 40u 100% 14u "Xoá luôn toàn bộ dữ liệu của Meow Hearing (không thể khôi phục)"
    Pop $MeowChk
    ${NSD_CreateLabel} 0 64u 100% 24u "Mẹo: muốn sao lưu, mở app → Cài đặt → Xuất thư viện (JSON) trước khi gỡ."
    Pop $0
    ${NSD_CreateLabel} 0 100u 100% 12u "Phát triển bởi CatMeow Team"
    Pop $0
    nsDialogs::Show
  FunctionEnd

  Function un.MeowDataLeave
    ${NSD_GetState} $MeowChk $MeowDelData
  FunctionEnd
!endif

!macro customUnInstall
  ${ifNot} ${isUpdated}
    ${if} $MeowDelData == ${BST_CHECKED}
      SetShellVarContext current
      RMDir /r "$APPDATA\Meow Hearing"
      RMDir /r "$LOCALAPPDATA\meow-hearing-updater"
    ${endif}
  ${endIf}
!macroend

; ---------- Bỏ bước hỏi "cài cho tất cả người dùng hay chỉ mình tôi": luôn cài cho người dùng hiện tại ----------
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
