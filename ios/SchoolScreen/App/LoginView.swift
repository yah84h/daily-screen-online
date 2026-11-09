import SwiftUI

struct LoginView: View {
    @Environment(AppModel.self) private var model
    @State private var username = ""
    @State private var password = ""
    @FocusState private var field: Field?
    private enum Field { case username, password }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 16) {
                        BrandMark().padding(.bottom, 8)
                        Text("شاشتك،\nبين يديك.").font(.largeTitle.bold())
                        Text("أخبار المدرسة ولحظاتها الجميلة،\nمن هاتفك إلى الشاشة.")
                            .font(.title3).foregroundStyle(.secondary)
                    }.padding(.top, 32)
                    VStack(alignment: .leading, spacing: 18) {
                        Text("تسجيل الدخول").font(.title2.bold())
                        VStack(alignment: .leading, spacing: 8) {
                            Text(model.localOnly ? "اسم المستخدم" : "اسم المستخدم أو البريد").font(.headline)
                            TextField("اسم المستخدم", text: $username)
                                .textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                                .keyboardType(.asciiCapable).submitLabel(.next).focused($field, equals: .username)
                                .onSubmit { field = .password }
                                .environment(\.layoutDirection, .leftToRight)
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Text("كلمة المرور").font(.headline)
                            SecureField("كلمة المرور", text: $password)
                                .textContentType(.password).submitLabel(.go).focused($field, equals: .password)
                                .onSubmit { signIn() }.environment(\.layoutDirection, .leftToRight)
                        }
                        PrimaryButton(title: "دخول إلى شاشاتي", icon: "arrow.left", busy: model.loading,
                                      disabled: username.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty || model.api == nil,
                                      action: signIn)
                    }
                    .textFieldStyle(.roundedBorder)
                    .padding(22).background(.background, in: RoundedRectangle(cornerRadius: 24))
                    if model.localOnly {
                        InfoNote(text: "الخادم المحلي: " + (model.configuration?.siteURL.absoluteString ?? ""), icon: "wifi")
                        Button("تغيير عنوان الخادم") { model.showServerSetup = true }.frame(minHeight: 44)
                    }
                    InfoNote(text: model.localOnly ? "استخدم حساب النسخة المحلية. حساب الموقع الأونلاين منفصل عنها." : "استخدم حساب المدرسة نفسه. إذا لم يكن لديك حساب، تواصل مع المسؤول.", icon: "lock.shield")
                    Button("جولة تجريبية بدون تسجيل دخول") { model.startDemo() }
                        .font(.subheadline).frame(maxWidth: .infinity, minHeight: 48)
                }.padding(24).frame(maxWidth: 560)
                    .frame(maxWidth: .infinity)
            }.background(Brand.background).scrollDismissesKeyboard(.interactively)
                .disabled(model.loading)
        }
    }
    private func signIn() {
        guard !model.loading, !username.isEmpty, !password.isEmpty else { return }
        field = nil
        Task { await model.signIn(username: username, password: password); password = "" }
    }
}
