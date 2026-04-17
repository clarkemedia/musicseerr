import Button from '@app/components/Common/Button'
import defineMessages from '@app/utils/defineMessages'
import { ApiErrorCode } from '@server/constants/error'
import axios from 'axios'
import { Field, Form, Formik } from 'formik'
import { FormattedMessage, useIntl } from 'react-intl'
import { useToasts } from 'react-toast-notifications'
import * as Yup from 'yup'

const messages = defineMessages('components.Login', {
  navidromeUrl: 'Navidrome URL',
  username: 'Username',
  password: 'Password',
  validationurlrequired: 'Navidrome URL is required',
  validationusernamerequired: 'Username required',
  loginerror: 'Something went wrong while trying to sign in.',
  credentialerror: 'The username or password is incorrect.',
  invalidurlerror: 'Unable to connect to Navidrome server.',
  adminerror: 'You must use an admin account to sign in.',
  signingin: 'Connecting\u2026',
  signin: 'Connect',
  back: 'Go back',
})

interface NavidromeSetupProps {
  revalidate: () => void
  onCancel?: () => void
}

function NavidromeSetup({ revalidate, onCancel }: NavidromeSetupProps) {
  const toasts = useToasts()
  const intl = useIntl()

  const SetupSchema = Yup.object().shape({
    hostname: Yup.string().required(
      intl.formatMessage(messages.validationurlrequired)
    ),
    username: Yup.string().required(
      intl.formatMessage(messages.validationusernamerequired)
    ),
    password: Yup.string(),
  })

  return (
    <Formik
      initialValues={{
        hostname: '',
        username: '',
        password: '',
        email: '',
      }}
      validationSchema={SetupSchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/auth/navidrome', {
            username: values.username,
            password: values.password,
            hostname: values.hostname,
            email: values.email || values.username,
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
            case ApiErrorCode.NotAdmin:
              errorMessage = messages.adminerror
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
        <Form>
          <div className="sm:border-t sm:border-gray-800">
            <div className="mt-2">
              <label htmlFor="hostname" className="text-label">
                {intl.formatMessage(messages.navidromeUrl)}
              </label>
              <div className="mb-2 mt-1">
                <Field
                  id="hostname"
                  name="hostname"
                  type="text"
                  placeholder="http://192.168.1.x:4533"
                  autoComplete="off"
                  data-form-type="other"
                  data-1pignore="true"
                  data-lpignore="true"
                />
              </div>
              {errors.hostname && touched.hostname && (
                <div className="error">{errors.hostname}</div>
              )}
            </div>

            <div className="mt-2">
              <label htmlFor="email" className="text-label">
                Email Address (optional)
              </label>
              <div className="mb-2 mt-1">
                <Field
                  id="email"
                  name="email"
                  type="text"
                  placeholder="admin@example.com"
                  autoComplete="off"
                  data-form-type="other"
                  data-1pignore="true"
                  data-lpignore="true"
                />
              </div>
            </div>

            <div className="mt-2">
              <label htmlFor="username" className="text-label">
                {intl.formatMessage(messages.username)}
              </label>
              <div className="mb-2 mt-1">
                <Field
                  id="username"
                  name="username"
                  type="text"
                  placeholder={intl.formatMessage(messages.username)}
                  autoComplete="off"
                  data-form-type="other"
                  data-1pignore="true"
                  data-lpignore="true"
                />
              </div>
              {errors.username && touched.username && (
                <div className="error">{errors.username}</div>
              )}
            </div>

            <div className="mt-2">
              <label htmlFor="password" className="text-label">
                {intl.formatMessage(messages.password)}
              </label>
              <div className="mb-2 mt-1">
                <Field
                  id="password"
                  name="password"
                  type="password"
                  placeholder={intl.formatMessage(messages.password)}
                  autoComplete="off"
                  data-form-type="other"
                  data-1pignore="true"
                  data-lpignore="true"
                />
              </div>
              {errors.password && touched.password && (
                <div className="error">{errors.password}</div>
              )}
            </div>
          </div>

          <div className="mt-8 border-t border-gray-700 pt-5">
            <div className="flex flex-row-reverse justify-between">
              <span className="inline-flex rounded-md shadow-sm">
                <Button
                  buttonType="primary"
                  type="submit"
                  disabled={isSubmitting || !isValid}
                >
                  {isSubmitting
                    ? intl.formatMessage(messages.signingin)
                    : intl.formatMessage(messages.signin)}
                </Button>
              </span>
              {onCancel && (
                <span className="inline-flex rounded-md shadow-sm">
                  <Button buttonType="default" onClick={() => onCancel()}>
                    <FormattedMessage {...messages.back} />
                  </Button>
                </span>
              )}
            </div>
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default NavidromeSetup
