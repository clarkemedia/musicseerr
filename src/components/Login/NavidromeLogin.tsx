import Button from '@app/components/Common/Button'
import SensitiveInput from '@app/components/Common/SensitiveInput'
import defineMessages from '@app/utils/defineMessages'
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline'
import { ApiErrorCode } from '@server/constants/error'
import axios from 'axios'
import { Field, Form, Formik } from 'formik'
import { useIntl } from 'react-intl'
import { useToasts } from 'react-toast-notifications'
import * as Yup from 'yup'

const messages = defineMessages('components.Login', {
  loginwithnavidrome: 'Login with Navidrome',
  username: 'Username',
  password: 'Password',
  validationusernamerequired: 'Username required',
  loginerror: 'Something went wrong while trying to sign in.',
  credentialerror: 'The username or password is incorrect.',
  invalidurlerror: 'Unable to connect to Navidrome server.',
  signingin: 'Signing In\u2026',
  signin: 'Sign In',
})

interface NavidromeLoginProps {
  revalidate: () => void
}

const NavidromeLogin: React.FC<NavidromeLoginProps> = ({ revalidate }) => {
  const toasts = useToasts()
  const intl = useIntl()

  const LoginSchema = Yup.object().shape({
    username: Yup.string().required(
      intl.formatMessage(messages.validationusernamerequired)
    ),
    password: Yup.string(),
  })

  return (
    <div>
      <Formik
        initialValues={{
          username: '',
          password: '',
        }}
        validationSchema={LoginSchema}
        validateOnBlur={false}
        onSubmit={async (values) => {
          try {
            await axios.post('/api/v1/auth/navidrome', {
              username: values.username,
              password: values.password,
              email: values.username,
            })
          } catch (e) {
            let errorMessage = messages.loginerror
            switch (e?.response?.data?.message) {
              case ApiErrorCode.InvalidUrl:
                errorMessage = messages.invalidurlerror
                break
              case ApiErrorCode.InvalidCredentials:
                errorMessage = messages.credentialerror
                break
            }
            toasts.addToast(intl.formatMessage(errorMessage), {
              autoDismiss: true,
              appearance: 'error',
            })
          } finally {
            revalidate()
          }
        }}
      >
        {({ errors, touched, isSubmitting, isValid }) => (
          <>
            <Form data-form-type="login">
              <div>
                <h2 className="-mt-1 mb-6 text-center text-lg font-bold text-neutral-200">
                  {intl.formatMessage(messages.loginwithnavidrome)}
                </h2>

                <div className="mb-4 mt-1">
                  <div className="form-input-field">
                    <Field
                      id="username"
                      name="username"
                      type="text"
                      placeholder={intl.formatMessage(messages.username)}
                      className="!bg-gray-700/80 placeholder:text-gray-400"
                      data-form-type="username"
                    />
                  </div>
                  {errors.username && touched.username && (
                    <div className="error">{errors.username}</div>
                  )}
                </div>

                <div className="mb-2 mt-1">
                  <div className="form-input-field">
                    <SensitiveInput
                      as="field"
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder={intl.formatMessage(messages.password)}
                      className="!bg-gray-700/80 placeholder:text-gray-400"
                      data-form-type="password"
                      data-1pignore="false"
                      data-lpignore="false"
                    />
                  </div>
                </div>
              </div>

              <Button
                buttonType="primary"
                type="submit"
                disabled={isSubmitting || !isValid}
                className="mt-2 w-full shadow-sm"
              >
                <ArrowLeftOnRectangleIcon />
                <span>
                  {isSubmitting
                    ? intl.formatMessage(messages.signingin)
                    : intl.formatMessage(messages.signin)}
                </span>
              </Button>
            </Form>
          </>
        )}
      </Formik>
    </div>
  )
}

export default NavidromeLogin
